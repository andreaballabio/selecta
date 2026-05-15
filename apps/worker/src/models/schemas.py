from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import date

class TrackFeatures(BaseModel):
    """Audio features extracted from track."""
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
    embedding: List[float]  # 64-dim

class AnalysisRequest(BaseModel):
    """Request to analyze a track."""
    track_id: str
    audio_url: str
    title: Optional[str] = None
    artist: Optional[str] = None

class AnalysisResponse(BaseModel):
    """Response from track analysis."""
    track_id: str
    features: TrackFeatures
    success: bool
    error: Optional[str] = None

class LabelMatch(BaseModel):
    """Match result for a label."""
    label_id: str
    label_name: str
    slug: str
    final_probability: float
    rank: int
    
    # Detailed scores
    sound_match_score: float
    trend_alignment_score: float
    accessibility_score: float
    novelty_score: float
    saturation_penalty: float
    recency_boost: float
    
    # Reasoning
    reasoning: str
    strengths: List[str]
    weaknesses: List[str]
    improvement_suggestions: List[str]

class MatchingRequest(BaseModel):
    """Request to match track against labels."""
    track_id: str
    embedding: List[float]
    features: Dict[str, Any]

class MatchingResponse(BaseModel):
    """Response with label matches."""
    track_id: str
    matches: List[LabelMatch]
    top_label_id: Optional[str] = None
    top_probability: Optional[float] = None

class SpotifyTrack(BaseModel):
    """Track data from Spotify."""
    spotify_id: str
    title: str
    artist: str
    album: Optional[str] = None
    release_date: Optional[date] = None
    preview_url: Optional[str] = None
    bpm: Optional[float] = None
    key: Optional[int] = None  # 0-11
    mode: Optional[int] = None  # 0=minor, 1=major
    energy: Optional[float] = None
    loudness: Optional[float] = None
