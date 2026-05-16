from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import numpy as np
import httpx
import tempfile
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("selecta_worker")

app = FastAPI(title="Selecta Worker", version="2.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrackFeatures(BaseModel):
    bpm: float
    key: str
    scale: str
    energy: float
    lufs: float
    duration: float
    spectral_centroid: float
    spectral_rolloff: float
    zero_crossing_rate: float
    mfcc_mean: List[float]
    embedding: List[float]

class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    artist_level: str = "emerging"

class AnalysisResponse(BaseModel):
    track_id: str
    features: TrackFeatures
    success: bool = True
    error: Optional[str] = None

# Lazy load essentia only when needed
_essentia_loaded = False

def load_essentia():
    global _essentia_loaded
    if not _essentia_loaded:
        try:
            import essentia.standard as es
            _essentia_loaded = True
            return es
        except ImportError:
            logger.warning("Essentia not available, falling back to librosa")
            return None
    return None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "2.0.0"}

@app.post("/analyze")
async def analyze_track(request: AnalysisRequest):
    tmp_path = None
    try:
        logger.info(f"Analyzing track: {request.track_id}")
        logger.info(f"Downloading from: {request.file_url}")
        
        # Download audio file
        async with httpx.AsyncClient() as client:
            response = await client.get(request.file_url, timeout=60.0)
            response.raise_for_status()
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name
                logger.info(f"Downloaded {len(response.content)} bytes")
        
        # Try Essentia first, fallback to librosa
        es = load_essentia()
        
        if es:
            # Use Essentia for professional analysis
            logger.info("Using Essentia for analysis")
            
            # Load audio
            loader = es.MonoLoader(filename=tmp_path)
            audio = loader()
            
            # BPM - RhythmExtractor2013 returns (bpm, ticks, confidence, estimates, bpmIntervals)
            rhythm_extractor = es.RhythmExtractor2013()
            rhythm_result = rhythm_extractor(audio)
            bpm = float(rhythm_result[0])  # First value is BPM
            
            # Key detection with Essentia (more accurate)
            key_extractor = es.KeyExtractor()
            key, scale, _ = key_extractor(audio)
            
            # Loudness (LUFS) - requires stereo input
            # Convert mono to stereo for EBU R128
            stereo_audio = np.array([audio, audio]).T  # shape: (samples, 2)
            loudness = es.LoudnessEBUR128()
            _, _, integrated_loudness, _ = loudness(stereo_audio)
            lufs = float(integrated_loudness)
            
            # Energy
            energy_algo = es.Energy()
            energy = energy_algo(audio)
            
            # Spectral features
            spectrum = es.Spectrum()
            spectral_centroid_algo = es.Centroid()
            spectral_rolloff_algo = es.RollOff()
            
            spec = spectrum(audio)
            spectral_centroid = spectral_centroid_algo(spec)
            spectral_rolloff = spectral_rolloff_algo(spec)
            
            # Duration
            duration = len(audio) / 44100.0  # Essentia uses 44100 by default
            
            # Zero crossing rate
            zcr_algo = es.ZeroCrossingRate()
            zero_crossing_rate = zcr_algo(audio)
            
            # MFCC
            mfcc_algo = es.MFCC()
            _, mfcc_coeffs = mfcc_algo(spectrum(audio))
            mfcc_mean = [float(np.mean(mfcc_coeffs[i])) for i in range(13)]
            
        else:
            # Fallback to librosa
            logger.info("Using Librosa for analysis")
            import librosa
            
            y, sr = librosa.load(tmp_path, sr=None, mono=True)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # BPM
            tempo_result = librosa.beat.beat_track(y=y, sr=sr)
            bpm = float(tempo_result[0]) if isinstance(tempo_result, tuple) else float(tempo_result)
            
            # Key
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            chroma_mean = np.mean(chroma, axis=1)
            key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            key_idx = int(np.argmax(chroma_mean))
            key = key_names[key_idx]
            minor_third = (key_idx + 3) % 12
            scale = 'minor' if chroma_mean[minor_third] > chroma_mean[key_idx] * 0.7 else 'major'
            
            # Energy
            rms = librosa.feature.rms(y=y)[0]
            energy = float(np.mean(rms))
            lufs = -14.0 - (energy * 10.0)
            
            # Spectral
            spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            spectral_centroid = float(np.mean(spectral_centroids))
            spectral_rolloff = float(np.mean(spectral_rolloff))
            
            # ZCR
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            zero_crossing_rate = float(np.mean(zcr))
            
            # MFCC
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_mean = [float(np.mean(mfccs[i])) for i in range(13)]
        
        # Generate 64-dim embedding (same for both methods)
        embedding = []
        # Use MFCC for embedding base
        for i in range(min(13, len(mfcc_mean))):
            embedding.append(mfcc_mean[i])
            embedding.append(mfcc_mean[i] * 0.5)  # Pseudo-std
        # Add other features
        embedding.append(float(bpm) / 200.0)
        embedding.append(float(energy))
        embedding.append(float(spectral_centroid) / 8000.0)
        embedding.append(float(spectral_rolloff) / 16000.0)
        embedding.append(float(zero_crossing_rate))
        embedding.append(float(duration) / 300.0)
        embedding.append(1.0 if scale == 'major' else 0.0)
        embedding.append(float(ord(key[0])) / 90.0)  # Normalize key letter
        # Pad to 64
        while len(embedding) < 64:
            embedding.append(0.0)
        embedding = embedding[:64]
        # Normalize
        emb_array = np.array(embedding)
        norm = np.linalg.norm(emb_array)
        if norm > 0:
            emb_array = emb_array / norm
        embedding = emb_array.tolist()
        
        logger.info(f"Analysis complete: BPM={float(bpm):.1f}, Key={key} {scale}")
        
        return AnalysisResponse(
            track_id=request.track_id,
            features=TrackFeatures(
                bpm=float(bpm),
                key=str(key),
                scale=str(scale).lower(),
                energy=float(energy),
                lufs=float(lufs),
                duration=float(duration),
                spectral_centroid=float(spectral_centroid),
                spectral_rolloff=float(spectral_rolloff),
                zero_crossing_rate=float(zero_crossing_rate),
                mfcc_mean=mfcc_mean,
                embedding=embedding
            ),
            success=True
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
        
    finally:
        # Cleanup temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            logger.info("Cleaned up temp file")

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
