from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import os
import tempfile
import logging
import httpx

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Selecta Audio Worker", version="1.0.0")

# CORS
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    artist_level: str = "emerging"

class AnalysisResponse(BaseModel):
    track_id: str
    features: dict
    top_matches: List[dict]
    ar_feedback: str
    improvement_suggestions: List[str]
    demo_strategy: str

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "1.0.0"}

@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_track(request: AnalysisRequest):
    """Analyze audio track and return features + label matches."""
    logger.info(f"Starting analysis for track {request.track_id}")
    logger.info(f"File URL: {request.file_url}")
    
    tmp_path = None
    
    try:
        # 1. Download file
        logger.info("Downloading file...")
        async with httpx.AsyncClient() as client:
            response = await client.get(request.file_url, timeout=30.0)
            if response.status_code != 200:
                raise HTTPException(status_code=400, detail=f"Failed to download: {response.status_code}")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name
                logger.info(f"Downloaded {len(response.content)} bytes")
        
        # 2. Extract features using librosa
        logger.info("Extracting features with librosa...")
        import librosa
        
        y, sr = librosa.load(tmp_path, sr=None)
        duration = librosa.get_duration(y=y, sr=sr)
        
        # BPM
        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo_result[0]) if isinstance(tempo_result, tuple) else float(tempo_result)
        
        # Key detection
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        chroma_mean = np.mean(chroma, axis=1)
        key_idx = np.argmax(chroma_mean)
        key = key_names[key_idx]
        
        # Simple major/minor detection
        minor_third = (key_idx + 3) % 12
        major_correlation = chroma_mean[key_idx]
        minor_correlation = chroma_mean[minor_third]
        scale = 'minor' if minor_correlation > major_correlation * 0.8 else 'major'
        
        # Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        
        # Energy curve
        hop_length = 512
        rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
        max_rms = float(np.max(rms)) if np.max(rms) > 0 else 1.0
        energy_curve = [float(x) for x in (rms / max_rms).tolist()[:100]]  # Limit to 100 points
        
        # LUFS estimation (simplified)
        lufs = -14.0 - (float(np.mean(rms)) * 10.0)
        
        # Generate embedding (MFCC-based)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
        chroma_features = librosa.feature.chroma_cqt(y=y, sr=sr, n_chroma=12)
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
        
        embedding = []
        embedding.extend(np.mean(mfccs, axis=1).tolist())
        embedding.extend(np.std(mfccs, axis=1).tolist())
        embedding.extend(np.mean(chroma_features, axis=1).tolist())
        embedding.extend(np.mean(contrast, axis=1).tolist())
        
        # Pad to 128 dimensions
        target_dim = 128
        if len(embedding) < target_dim:
            embedding.extend([0.0] * (target_dim - len(embedding)))
        else:
            embedding = embedding[:target_dim]
        
        features = {
            "bpm": round(tempo, 1),
            "key": key,
            "scale": scale,
            "lufs": round(lufs, 1),
            "energy_curve": energy_curve,
            "duration": round(duration, 1),
            "spectral_centroid_mean": round(float(np.mean(spectral_centroids)), 1),
            "spectral_rolloff_mean": round(float(np.mean(spectral_rolloff)), 1),
            "zero_crossing_rate_mean": round(float(np.mean(zcr)), 4),
            "embedding": embedding
        }
        
        logger.info(f"Features extracted: BPM={features['bpm']}, Key={features['key']}, Scale={features['scale']}")
        
        # Cleanup
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        
        # Mock matches and feedback for now (will be improved later)
        top_matches = [
            {
                "label_id": "solid-grooves",
                "label_name": "Solid Grooves Records",
                "sound_match_score": 85.0,
                "accessibility_score": 70.0,
                "trend_score": 75.0,
                "final_probability": 78.0,
                "reasoning": f"Great match for Solid Grooves sound at {features['bpm']:.0f} BPM with {features['key']} {features['scale']} tonality."
            },
            {
                "label_id": "hot-creations",
                "label_name": "Hot Creations",
                "sound_match_score": 72.0,
                "accessibility_score": 85.0,
                "trend_score": 80.0,
                "final_probability": 68.0,
                "reasoning": "Good accessibility match with commercial appeal."
            }
        ]
        
        return AnalysisResponse(
            track_id=request.track_id,
            features=features,
            top_matches=top_matches,
            ar_feedback=f"This track shows strong potential at {features['bpm']:.0f} BPM in {features['key']} {features['scale']}. The spectral balance indicates good club readiness.",
            improvement_suggestions=["Consider slightly more dynamic range", "Check low-end balance"],
            demo_strategy="Submit to Solid Grooves first, then Hot Creations after 2 weeks."
        )
        
    except HTTPException:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        logger.error(f"Analysis error: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8080))
    uvicorn.run(app, host="0.0.0.0", port=port)
