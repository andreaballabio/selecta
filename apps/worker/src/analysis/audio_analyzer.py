import numpy as np
import librosa
import tempfile
import os
from typing import Tuple, Optional
import httpx

from ..models.schemas import TrackFeatures
from ..utils.logging import logger

class AudioAnalyzer:
    """Extract audio features from preview files."""
    
    def __init__(self, embedding_dim: int = 64):
        self.embedding_dim = embedding_dim
        
    async def analyze_from_url(self, audio_url: str) -> TrackFeatures:
        """Download and analyze audio from URL."""
        
        # Download to temp file
        tmp_path = None
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(audio_url, timeout=30.0)
                response.raise_for_status()
                
                # Save to temp file
                with tempfile.NamedTemporaryFile(
                    delete=False, 
                    suffix='.mp3',
                    dir='/tmp'
                ) as tmp:
                    tmp.write(response.content)
                    tmp_path = tmp.name
                    logger.info(f"Downloaded {len(response.content)} bytes")
            
            # Analyze
            features = self._analyze_file(tmp_path)
            return features
            
        finally:
            # Cleanup
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
                logger.info("Cleaned up temp file")
    
    def _analyze_file(self, file_path: str) -> TrackFeatures:
        """Extract features from local file."""
        
        # Load audio
        y, sr = librosa.load(file_path, sr=None, mono=True)
        duration = librosa.get_duration(y=y, sr=sr)
        
        logger.info(f"Loaded audio: {duration:.2f}s, {sr}Hz")
        
        # 1. BPM detection
        tempo_result = librosa.beat.beat_track(y=y, sr=sr)
        bpm = float(tempo_result[0]) if isinstance(tempo_result, tuple) else float(tempo_result)
        
        # 2. Key detection
        key, scale = self._detect_key(y, sr)
        
        # 3. Energy (RMS)
        rms = librosa.feature.rms(y=y)[0]
        energy = float(np.mean(rms))
        
        # 4. LUFS estimation
        lufs = -14.0 - (energy * 10.0)  # Simplified estimation
        
        # 5. Spectral features
        spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
        spectral_rolloff = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
        
        spectral_centroid = float(np.mean(spectral_centroids))
        spectral_rolloff = float(np.mean(spectral_rolloff))
        
        # 6. Zero crossing rate
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        zero_crossing_rate = float(np.mean(zcr))
        
        # 7. MFCC (13 coefficients)
        mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
        mfcc_mean = [float(np.mean(mfccs[i])) for i in range(13)]
        
        # 8. Generate embedding (64-dim)
        embedding = self._generate_embedding(
            y, sr, mfccs, bpm, energy, spectral_centroid
        )
        
        logger.info(f"Analysis complete: BPM={bpm:.1f}, Key={key} {scale}")
        
        return TrackFeatures(
            bpm=bpm,
            key=key,
            scale=scale,
            energy=energy,
            lufs=lufs,
            duration=duration,
            spectral_centroid=spectral_centroid,
            spectral_rolloff=spectral_rolloff,
            zero_crossing_rate=zero_crossing_rate,
            mfcc_mean=mfcc_mean,
            embedding=embedding
        )
    
    def _detect_key(self, y: np.ndarray, sr: int) -> Tuple[str, str]:
        """Detect musical key and scale."""
        
        # Chroma features
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        
        # Key names
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = int(np.argmax(chroma_mean))
        key = key_names[key_idx]
        
        # Major vs Minor detection
        # Minor third correlation
        minor_third = (key_idx + 3) % 12
        major_correlation = chroma_mean[key_idx]
        minor_correlation = chroma_mean[minor_third]
        
        # If minor third is strong relative to tonic, likely minor
        scale = 'minor' if minor_correlation > major_correlation * 0.7 else 'major'
        
        return key, scale
    
    def _generate_embedding(
        self, 
        y: np.ndarray, 
        sr: int, 
        mfccs: np.ndarray,
        bpm: float,
        energy: float,
        spectral_centroid: float
    ) -> list:
        """Generate 64-dim embedding from features."""
        
        # Feature vector components
        embedding = []
        
        # 1. MFCC statistics (26 dims)
        # Mean and std of each MFCC coefficient
        for i in range(13):
            embedding.append(float(np.mean(mfccs[i])))
            embedding.append(float(np.std(mfccs[i])))
        
        # 2. Chroma features (12 dims)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        embedding.extend([float(x) for x in chroma_mean])
        
        # 3. Spectral contrast (6 dims)
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr)
        contrast_mean = np.mean(contrast, axis=1)
        embedding.extend([float(x) for x in contrast_mean[:6]])
        
        # 4. Rhythm features (4 dims)
        onset_env = librosa.onset.onset_strength(y=y, sr=sr)
        embedding.append(float(np.mean(onset_env)))
        embedding.append(float(np.std(onset_env)))
        embedding.append(float(bpm / 200.0))  # Normalized BPM
        embedding.append(float(energy))
        
        # 5. Spectral features (4 dims)
        embedding.append(float(spectral_centroid / 8000.0))  # Normalized
        embedding.append(float(np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))))
        embedding.append(float(np.mean(librosa.feature.spectral_flatness(y=y))))
        embedding.append(float(np.mean(librosa.feature.spectral_rolloff(y=y, sr=sr))))
        
        # 6. Zero crossing and duration (2 dims)
        zcr = librosa.feature.zero_crossing_rate(y)[0]
        embedding.append(float(np.mean(zcr)))
        embedding.append(float(len(y) / sr / 300.0))  # Normalized duration
        
        # 7. Pad or truncate to 64 dims
        target_dim = 64
        if len(embedding) < target_dim:
            embedding.extend([0.0] * (target_dim - len(embedding)))
        elif len(embedding) > target_dim:
            embedding = embedding[:target_dim]
        
        # Normalize to unit vector (cosine similarity works better)
        embedding_array = np.array(embedding)
        norm = np.linalg.norm(embedding_array)
        if norm > 0:
            embedding_array = embedding_array / norm
        
        return embedding_array.tolist()
