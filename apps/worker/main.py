from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import numpy as np
import os
import tempfile
import logging

# Audio analysis libraries
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False
    logging.warning("Librosa not available. Using mock data.")

# Essentia is optional - skip if not available
try:
    import essentia
    from essentia.standard import (
        MonoLoader, 
        KeyExtractor, 
        BeatTrackerDegara,
        LoudnessEBUR128,
        Energy
    )
    ESSENTIA_AVAILABLE = True
except ImportError:
    ESSENTIA_AVAILABLE = False
    logging.warning("Essentia not available. Some features will be limited.")

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Selecta Audio Worker", version="1.0.0")

# Get allowed origins from environment
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AudioFeatures(BaseModel):
    bpm: float
    key: str
    scale: str
    lufs: float
    energy_curve: List[float]
    duration: float
    spectral_centroid_mean: float
    spectral_rolloff_mean: float
    zero_crossing_rate_mean: float
    embedding: Optional[List[float]] = None

class LabelMatch(BaseModel):
    label_id: str
    label_name: str
    sound_match_score: float
    accessibility_score: float
    trend_score: float
    final_probability: float
    reasoning: str

class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    artist_level: str = "emerging"  # emerging, mid, established

class AnalysisResponse(BaseModel):
    track_id: str
    features: AudioFeatures
    top_matches: List[LabelMatch]
    ar_feedback: str
    improvement_suggestions: List[str]
    demo_strategy: str


@app.get("/health")
async def health_check():
    return {
        "status": "healthy", 
        "essentia_available": ESSENTIA_AVAILABLE,
        "version": "1.0.0"
    }


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_track(request: AnalysisRequest):
    """
    Main analysis endpoint. Downloads track, extracts features, 
    matches with labels, generates A&R feedback.
    """
    logger.info(f"Starting analysis for track {request.track_id}")
    
    try:
        # 1. Download file from URL (temporary for analysis)
        import urllib.request
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp:
            urllib.request.urlretrieve(request.file_url, tmp.name)
            tmp_path = tmp.name
        
        # 2. Extract audio features
        features = await extract_features(tmp_path)
        
        # 3. Generate embedding (using pre-trained model)
        features.embedding = await generate_embedding(tmp_path)
        
        # 4. Match with label database
        top_matches = await match_with_labels(features, request.artist_level)
        
        # 5. Generate A&R feedback via LLM
        ar_feedback = await generate_ar_feedback(features, top_matches)
        
        # 6. Generate improvement suggestions
        improvements = await generate_improvements(features, top_matches)
        
        # 7. Demo strategy
        demo_strategy = await generate_demo_strategy(top_matches, request.artist_level)
        
        # Cleanup
        os.unlink(tmp_path)
        
        return AnalysisResponse(
            track_id=request.track_id,
            features=features,
            top_matches=top_matches,
            ar_feedback=ar_feedback,
            improvement_suggestions=improvements,
            demo_strategy=demo_strategy
        )
        
    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


async def extract_features(audio_path: str) -> AudioFeatures:
    """Extract comprehensive audio features using librosa and essentia."""
    
    # Load with librosa
    y, sr = librosa.load(audio_path, sr=None)
    duration = librosa.get_duration(y=y, sr=sr)
    
    # Basic features
    tempo_result = librosa.beat.beat_track(y=y, sr=sr)
    # In librosa 0.10+, beat_track returns (tempo, beats) where tempo is a scalar or array
    if isinstance(tempo_result, tuple):
        tempo = float(tempo_result[0])
    else:
        tempo = float(tempo_result)
    
    # Spectral features
    spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
    spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    
    # Energy curve (normalized RMS per segment)
    hop_length = 512
    frame_length = 2048
    rms = librosa.feature.rms(y=y, frame_length=frame_length, hop_length=hop_length)[0]
    max_rms = float(np.max(rms))
    if max_rms > 0:
        energy_curve = [float(x) for x in (rms / max_rms).tolist()]
    else:
        energy_curve = [0.0] * len(rms)
    
    # Key detection with librosa
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
    chroma_mean = np.mean(chroma, axis=1)
    estimated_key_idx = np.argmax(chroma_mean)
    estimated_key = key_names[estimated_key_idx]
    
    # Determine scale (major/minor) using Krumhansl-Schmuckler
    # Simplified: assume minor if lots of flat notes
    minor_profile = np.array([6.3, 2.0, 3.5, 5.4, 2.3, 3.4, 2.3, 4.8, 4.0, 2.3, 3.2, 3.2])
    major_profile = np.array([6.3, 2.3, 3.5, 2.3, 4.8, 4.0, 2.3, 3.2, 3.2, 2.0, 4.8, 4.0])
    
    # Correlate with profiles
    correlations = []
    for i in range(12):
        rolled = np.roll(chroma_mean, i)
        corr_major = float(np.corrcoef(rolled, major_profile)[0,1])
        corr_minor = float(np.corrcoef(rolled, minor_profile)[0,1])
        correlations.append((corr_major, i, 'major'))
        correlations.append((corr_minor, i, 'minor'))
    
    best_match = max(correlations, key=lambda x: x[0])
    estimated_key = key_names[best_match[1]]
    estimated_scale = best_match[2]
    
    # LUFS estimation (simplified)
    # In production, use proper LUFS measurement
    lufs_estimate = -14.0 - (float(np.mean(rms)) * 10.0)
    
    return AudioFeatures(
        bpm=float(tempo),
        key=estimated_key,
        scale=estimated_scale,
        lufs=float(lufs_estimate),
        energy_curve=energy_curve[:100],  # Limit to 100 points for response
        duration=float(duration),
        spectral_centroid_mean=float(np.mean(spectral_centroids)),
        spectral_rolloff_mean=float(np.mean(spectral_rolloff)),
        zero_crossing_rate_mean=float(np.mean(zcr))
    )


async def generate_embedding(audio_path: str) -> List[float]:
    """
    Generate audio embedding using a pre-trained model.
    In production, use CLAP, VGGish, or MusicBERT.
    For MVP, use a combination of extracted features as proxy embedding.
    """
    y, sr = librosa.load(audio_path, sr=22050)
    
    # MFCC-based embedding (128-dimensional)
    mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=20)
    
    # Chroma features
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr, n_chroma=12)
    
    # Spectral contrast
    contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
    
    # Combine into fixed-length embedding
    embedding = []
    embedding.extend(np.mean(mfccs, axis=1).tolist())
    embedding.extend(np.std(mfccs, axis=1).tolist())
    embedding.extend(np.mean(chroma, axis=1).tolist())
    embedding.extend(np.mean(contrast, axis=1).tolist())
    
    # Pad or truncate to 128 dimensions
    target_dim = 128
    if len(embedding) < target_dim:
        embedding.extend([0.0] * (target_dim - len(embedding)))
    else:
        embedding = embedding[:target_dim]
    
    return embedding


async def match_with_labels(features: AudioFeatures, artist_level: str) -> List[LabelMatch]:
    """
    Match track features against label centroids.
    In production, fetch centroids from database.
    """
    # Mock label database - in production fetch from Supabase
    labels_db = [
        {
            "id": "solid-grooves",
            "name": "Solid Grooves Records",
            "centroid": np.random.randn(128).tolist(),  # Replace with real centroids
            "bpm_range": [123, 128],
            "artist_level": "mid",
            "commercial_score": 0.6,
            "underground_score": 0.8
        },
        {
            "id": "hot-creations", 
            "name": "Hot Creations",
            "centroid": np.random.randn(128).tolist(),
            "bpm_range": [120, 126],
            "artist_level": "top",
            "commercial_score": 0.7,
            "underground_score": 0.6
        },
        {
            "id": "black-book",
            "name": "Black Book Records",
            "centroid": np.random.randn(128).tolist(),
            "bpm_range": [124, 130],
            "artist_level": "emerging",
            "commercial_score": 0.4,
            "underground_score": 0.9
        },
        {
            "id": "defected",
            "name": "Defected Records",
            "centroid": np.random.randn(128).tolist(),
            "bpm_range": [122, 128],
            "artist_level": "top",
            "commercial_score": 0.9,
            "underground_score": 0.3
        },
        {
            "id": "toolroom",
            "name": "Toolroom Records",
            "centroid": np.random.randn(128).tolist(),
            "bpm_range": [124, 130],
            "artist_level": "mid",
            "commercial_score": 0.8,
            "underground_score": 0.4
        }
    ]
    
    matches = []
    track_embedding = np.array(features.embedding)
    
    for label in labels_db:
        # 1. Sound Match (cosine similarity)
        label_centroid = np.array(label["centroid"])
        cosine_sim = np.dot(track_embedding, label_centroid) / (
            np.linalg.norm(track_embedding) * np.linalg.norm(label_centroid)
        )
        sound_match = float((cosine_sim + 1) / 2 * 100)  # Normalize to 0-100
        
        # 2. BPM compatibility
        bpm_compatible = label["bpm_range"][0] <= features.bpm <= label["bpm_range"][1]
        bpm_penalty = 0 if bpm_compatible else 20
        
        # 3. Accessibility Score
        level_map = {"emerging": 1, "mid": 2, "established": 3}
        artist_val = level_map.get(artist_level, 1)
        label_val = level_map.get(label["artist_level"], 2)
        
        if artist_val >= label_val:
            accessibility = 80 + np.random.randint(0, 20)
        elif artist_val == label_val - 1:
            accessibility = 50 + np.random.randint(0, 30)
        else:
            accessibility = 20 + np.random.randint(0, 30)
        
        # 4. Trend alignment (mock)
        trend_score = 60 + np.random.randint(0, 40)
        
        # Final weighted probability
        final_prob = (
            sound_match * 0.50 +
            accessibility * 0.30 +
            trend_score * 0.20
        )
        
        # Apply BPM penalty
        final_prob = max(0, final_prob - bpm_penalty)
        
        # Generate reasoning
        reasoning = generate_reasoning(sound_match, accessibility, features, label)
        
        matches.append(LabelMatch(
            label_id=label["id"],
            label_name=label["name"],
            sound_match_score=round(sound_match, 1),
            accessibility_score=round(accessibility, 1),
            trend_score=round(trend_score, 1),
            final_probability=round(final_prob, 1),
            reasoning=reasoning
        ))
    
    # Sort by final probability
    matches.sort(key=lambda x: x.final_probability, reverse=True)
    return matches[:5]


def generate_reasoning(sound_match: float, accessibility: float, 
                       features: AudioFeatures, label: dict) -> str:
    """Generate human-readable reasoning for the match."""
    reasons = []
    
    if sound_match > 70:
        reasons.append(f"Strong sonic alignment with {label['name']}'s catalog")
    elif sound_match > 50:
        reasons.append(f"Moderate sonic fit with {label['name']}")
    else:
        reasons.append(f"Limited sonic overlap with {label['name']}")
    
    if accessibility > 70:
        reasons.append("Your artist profile matches their typical signings")
    elif accessibility < 40:
        reasons.append("This label typically signs more established artists")
    
    return "; ".join(reasons)


async def generate_ar_feedback(features: AudioFeatures, matches: List[LabelMatch]) -> str:
    """
    Generate A&R-style feedback using LLM.
    In production, call OpenAI/Claude API.
    """
    # Mock feedback - replace with actual LLM call
    top_label = matches[0]
    
    feedback = f"""
**Overall Evaluation**

This track demonstrates solid production fundamentals with a {features.bpm:.0f} BPM groove 
in {features.key} {features.scale}. The energy curve shows {'consistent' if np.std(features.energy_curve) < 0.3 else 'dynamic'} 
movement throughout the arrangement.

**Sonic Profile**
- Key: {features.key} {features.scale}
- Energy: {'High' if np.mean(features.energy_curve) > 0.6 else 'Medium' if np.mean(features.energy_curve) > 0.4 else 'Low'}
- Spectral Balance: {'Bright' if features.spectral_centroid_mean > 3000 else 'Warm'}

**Label Compatibility**
Your strongest match is **{top_label.label_name}** with a {top_label.final_probability:.0f}% compatibility score. 
{top_label.reasoning}

**Market Positioning**
This track fits well within the {'mainstream' if top_label.final_probability > 70 else 'niche'} tech house landscape. 
The production quality suggests {'ready for release' if features.lufs > -16 else 'needs some mix refinement'}.
"""
    
    return feedback.strip()


async def generate_improvements(features: AudioFeatures, matches: List[LabelMatch]) -> List[str]:
    """Generate actionable improvement suggestions."""
    suggestions = []
    
    # LUFS check
    if features.lufs < -16:
        suggestions.append(
            f"Mix loudness is at {features.lufs:.1f} LUFS. "
            "Consider limiting to achieve -14 to -12 LUFS for club-ready impact."
        )
    
    # Energy curve analysis
    energy_variance = np.std(features.energy_curve)
    if energy_variance < 0.2:
        suggestions.append(
            "The track maintains consistent energy throughout. "
            "Consider creating more contrast between sections to enhance dynamic impact."
        )
    
    # Spectral balance
    if features.spectral_rolloff_mean < 4000:
        suggestions.append(
            "Low-end frequency content is dominant. "
            "Ensure high-frequency elements (hats, percussion) have enough presence for club systems."
        )
    
    # BPM suggestions
    top_match = matches[0]
    bpm_range = [123, 128]  # Mock
    if features.bpm < bpm_range[0]:
        suggestions.append(
            f"BPM of {features.bpm:.0f} is slightly below {top_match.label_name}'s typical range. "
            f"Consider increasing to {bpm_range[0]}-{bpm_range[1]} for better alignment."
        )
    elif features.bpm > bpm_range[1]:
        suggestions.append(
            f"BPM of {features.bpm:.0f} is above {top_match.label_name}'s typical range. "
            "This could work for peak-time sets but may limit daytime playlist opportunities."
        )
    
    # Structure suggestions (mock)
    if features.duration < 180:
        suggestions.append(
            f"Track length ({features.duration:.0f}s) is shorter than typical club cuts. "
            "Consider extending with a longer breakdown or outro for DJ mixing."
        )
    
    return suggestions if suggestions else ["Track shows solid production across all analyzed parameters."]


async def generate_demo_strategy(matches: List[LabelMatch], artist_level: str) -> str:
    """Generate demo submission strategy."""
    
    tier1 = [m for m in matches if m.final_probability >= 70]
    tier2 = [m for m in matches if 50 <= m.final_probability < 70]
    tier3 = [m for m in matches if m.final_probability < 50]
    
    strategy = f"""
**Demo Submission Strategy for {artist_level.upper()} Artist**

**TIER 1 - High Probability ({len(tier1)} labels)**
Submit to these labels FIRST:
{chr(10).join([f"• {m.label_name} ({m.final_probability:.0f}% match)" for m in tier1]) if tier1 else '• No high-probability matches in current analysis'}

**TIER 2 - Medium Probability ({len(tier2)} labels)**
Submit after 2-3 weeks if Tier 1 declines:
{chr(10).join([f"• {m.label_name} ({m.final_probability:.0f}% match)" for m in tier2]) if tier2 else '• No medium-probability matches'}

**TIER 3 - Stretch Goals ({len(tier3)} labels)**
Consider after building more releases:
{chr(10).join([f"• {m.label_name} ({m.final_probability:.0f}% match)" for m in tier3]) if tier3 else '• No stretch matches'}

**Recommended Approach:**
1. Start with your highest match: **{matches[0].label_name if matches else 'N/A'}**
2. Personalize your submission mentioning specific releases from the label that influenced your sound
3. Include a private SoundCloud link with download enabled
4. Follow up after 2 weeks if no response
5. Only move to next tier after receiving explicit rejection

**Timeline:**
- Week 1-2: Submit to Tier 1
- Week 4: Follow up on Tier 1
- Week 5: Submit to Tier 2 if needed
- Week 8+: Consider Tier 3 or revise track
"""
    
    return strategy.strip()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
