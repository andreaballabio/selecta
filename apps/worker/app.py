from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import numpy as np
import httpx
import tempfile
import logging
import asyncio

# Import ingestion modules
from src.ingestion.pipeline import process_ingestion_queue

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
    bpm: Optional[float] = None  # None per preview
    key: Optional[str] = None    # None per preview  
    scale: Optional[str] = None  # None per preview
    energy: float
    lufs: float
    duration: float
    spectral_centroid: float
    spectral_rolloff: float
    zero_crossing_rate: float
    mfcc_mean: List[float]
    embedding: List[float]
    analysis_type: str = "full"  # "preview" o "full"

class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    artist_level: str = "emerging"
    is_preview: bool = False  # True = preview 30s (no BPM/Key), False = full track (completa)

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
            
            # Load audio stereo
            loader = es.AudioLoader(filename=tmp_path)
            audio_stereo, sample_rate, num_channels, _, _, _ = loader()
            
            # Convert to mono for algorithms that need mono
            audio_mono = np.mean(audio_stereo, axis=1)
            
            logger.info(f"Audio loaded: stereo {audio_stereo.shape}, mono {audio_mono.shape}, {sample_rate}Hz")
            logger.info(f"Analysis type: {'preview (no BPM/Key)' if request.is_preview else 'full track'}")
            
            # BPM e Key solo per full track, non per preview
            if not request.is_preview:
                # BPM - use mono
                rhythm_extractor = es.RhythmExtractor2013()
                rhythm_result = rhythm_extractor(audio_mono)
                bpm = float(rhythm_result[0])
                
                # Key detection - use mono
                key_extractor = es.KeyExtractor()
                key, scale, _ = key_extractor(audio_mono)
            else:
                # Per preview, non calcoliamo BPM/Key (troppo imprecisi)
                bpm = None
                key = None
                scale = None
            
            # Loudness (LUFFS) - use stereo
            loudness = es.LoudnessEBUR128()
            _, _, integrated_loudness, _ = loudness(audio_stereo)
            lufs = float(integrated_loudness)
            
            # Energy - use mono
            energy_algo = es.Energy()
            energy = energy_algo(audio_mono)
            
            # Spectral features - use mono
            spectrum = es.Spectrum()
            spectral_centroid_algo = es.Centroid()
            spectral_rolloff_algo = es.RollOff()
            
            spec = spectrum(audio_mono)
            spectral_centroid = spectral_centroid_algo(spec)
            spectral_rolloff = spectral_rolloff_algo(spec)
            
            # Duration
            duration = len(audio_mono) / sample_rate
            
            # Zero crossing rate - use mono
            zcr_algo = es.ZeroCrossingRate()
            zero_crossing_rate = zcr_algo(audio_mono)
            
            # MFCC - use mono
            mfcc_algo = es.MFCC()
            _, mfcc_coeffs = mfcc_algo(spectrum(audio_mono))
            mfcc_mean = [float(np.mean(mfcc_coeffs[i])) for i in range(13)]
            
        else:
            # Fallback to librosa
            logger.info("Using Librosa for analysis")
            import librosa
            
            y, sr = librosa.load(tmp_path, sr=None, mono=True)
            duration = librosa.get_duration(y=y, sr=sr)
            
            # BPM e Key solo per full track
            if not request.is_preview:
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
            else:
                bpm = None
                key = None
                scale = None
            
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
        # Add other features (BPM solo se disponibile)
        if bpm is not None:
            embedding.append(float(bpm) / 200.0)
        else:
            embedding.append(0.0)  # Placeholder per preview
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
        
        analysis_type = "preview" if request.is_preview else "full"
        logger.info(f"Analysis complete: type={analysis_type}, BPM={bpm if bpm else 'N/A'}, Key={key if key else 'N/A'}")
        
        return AnalysisResponse(
            track_id=request.track_id,
            features=TrackFeatures(
                bpm=bpm,  # Può essere None per preview
                key=key,  # Può essere None per preview
                scale=scale,  # Può essere None per preview
                energy=float(energy),
                lufs=float(lufs),
                duration=float(duration),
                spectral_centroid=float(spectral_centroid),
                spectral_rolloff=float(spectral_rolloff),
                zero_crossing_rate=float(zero_crossing_rate),
                mfcc_mean=mfcc_mean,
                embedding=embedding,
                analysis_type=analysis_type
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


# Ingestion Pipeline Endpoints
class IngestionRequest(BaseModel):
    label_id: Optional[str] = None
    batch_size: int = 10

@app.post("/ingestion/process")
async def process_ingestion(request: IngestionRequest):
    """Processa la coda di ingestion per trovare match su Spotify"""
    try:
        logger.info(f"Processing ingestion queue for label: {request.label_id or 'all'}")
        stats = await process_ingestion_queue(
            label_id=request.label_id,
            batch_size=request.batch_size
        )
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        logger.error(f"Ingestion error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/ingestion/stats")
async def get_ingestion_stats(label_id: Optional[str] = None):
    """Ottiene statistiche sulla coda di ingestion"""
    try:
        from supabase import create_client
        
        supabase = create_client(
            os.getenv("SUPABASE_URL"),
            os.getenv("SUPABASE_SERVICE_KEY")
        )
        
        query = supabase.table("label_ingestion_queue").select("status", count="exact")
        
        if label_id:
            query = query.eq("label_id", label_id)
        
        response = query.execute()
        
        # Conta per status
        status_counts = {}
        for item in response.data:
            status = item.get("status", "unknown")
            status_counts[status] = status_counts.get(status, 0) + 1
        
        return {
            "success": True,
            "counts": status_counts,
            "total": len(response.data)
        }
    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
