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

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("selecta_worker")

app = FastAPI(title="Selecta Worker", version="2.1.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class TrackFeatures(BaseModel):
    bpm: Optional[float] = None          # None for preview tracks
    key: Optional[str] = None            # None for preview tracks
    scale: Optional[str] = None          # None for preview tracks
    energy: float
    lufs: float
    duration: float
    spectral_centroid: float
    spectral_rolloff: float
    zero_crossing_rate: float
    sub_ratio: Optional[float] = None        # Sub-bass energy ratio (20-80 Hz / total)
    onset_strength: Optional[float] = None   # Normalized onset rate (transient density)
    mid_presence: Optional[float] = None     # Mid-freq energy ratio (500-2000 Hz / total)
    tempo_stability: Optional[float] = None  # Beat consistency 0-1 (0.5 = neutral/preview)
    spectral_contrast: Optional[float] = None  # Log peak/valley ratio across bands
    mfcc_mean: List[float]
    embedding: List[float]
    analysis_type: str = "full"  # "preview" or "full"

class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    artist_level: str = "emerging"
    is_preview: bool = False  # True = 30s preview (no BPM/Key), False = full track

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
    return {"status": "healthy", "version": "2.1.0"}

@app.post("/analyze")
async def analyze_track(request: AnalysisRequest):
    tmp_path = None
    try:
        logger.info(f"Analyzing track: {request.track_id}")
        logger.info(f"Downloading from: {request.file_url}")

        # Download audio file
        async with httpx.AsyncClient() as client:
            try:
                response = await client.get(request.file_url, timeout=60.0)
                response.raise_for_status()
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 403:
                    logger.error(f"403 Forbidden - Preview URL expired or blocked: {request.file_url}")
                    return AnalysisResponse(
                        track_id=request.track_id,
                        features=None,
                        success=False,
                        error="PREVIEW_EXPIRED"
                    )
                raise

            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name
                logger.info(f"Downloaded {len(response.content)} bytes")

        # Try Essentia first, fallback to librosa
        es = load_essentia()

        if es:
            # ── Essentia path ──────────────────────────────────────────────
            logger.info("Using Essentia for analysis")

            loader = es.AudioLoader(filename=tmp_path)
            audio_stereo, sample_rate, num_channels, _, _, _ = loader()
            audio_mono = np.mean(audio_stereo, axis=1)

            logger.info(f"Audio loaded: stereo {audio_stereo.shape}, mono {audio_mono.shape}, {sample_rate}Hz")
            logger.info(f"Analysis type: {'preview (no BPM/Key)' if request.is_preview else 'full track'}")

            # BPM + Key only for full tracks
            beat_positions = np.array([])
            if not request.is_preview:
                rhythm_extractor = es.RhythmExtractor2013()
                rhythm_result = rhythm_extractor(audio_mono)
                bpm = float(rhythm_result[0])
                beat_positions = np.array(rhythm_result[1])

                key_extractor = es.KeyExtractor()
                key, scale, _ = key_extractor(audio_mono)
            else:
                bpm = None
                key = None
                scale = None

            # Tempo stability: consistency of inter-beat intervals
            # Always 0.5 for previews (partial clips are unreliable)
            if not request.is_preview and len(beat_positions) > 2:
                ibis = np.diff(beat_positions)
                ibi_mean = float(np.mean(ibis))
                ibi_std = float(np.std(ibis))
                tempo_stability = float(max(0.0, min(1.0, 1.0 - ibi_std / ibi_mean))) if ibi_mean > 0 else 0.5
            else:
                tempo_stability = 0.5

            # Loudness (LUFS) – needs stereo
            loudness = es.LoudnessEBUR128()
            _, _, integrated_loudness, _ = loudness(audio_stereo)
            lufs = float(integrated_loudness)

            # Energy
            energy_algo = es.Energy()
            energy = float(energy_algo(audio_mono))

            # Spectral features (full-signal spectrum)
            spectrum_algo = es.Spectrum()
            spectral_centroid_algo = es.Centroid()
            spectral_rolloff_algo = es.RollOff()
            spec = spectrum_algo(audio_mono)
            spectral_centroid = float(spectral_centroid_algo(spec))
            spectral_rolloff = float(spectral_rolloff_algo(spec))

            # Duration
            duration = float(len(audio_mono) / sample_rate)

            # Zero crossing rate
            zcr_algo = es.ZeroCrossingRate()
            zero_crossing_rate = float(zcr_algo(audio_mono))

            # MFCC (on full-signal spectrum)
            mfcc_algo = es.MFCC()
            _, mfcc_coeffs = mfcc_algo(spectrum_algo(audio_mono))
            mfcc_mean = [float(mfcc_coeffs[i]) for i in range(13)]

            # ── NEW: Band energy ratios + spectral contrast via numpy FFT ──
            # Use up to 30s of audio for fast, representative computation
            audio_arr = np.array(audio_mono, dtype=np.float32)
            chunk = audio_arr[:min(len(audio_arr), int(sample_rate * 30))]
            fft_mag_sq = np.abs(np.fft.rfft(chunk)) ** 2
            fft_freqs = np.fft.rfftfreq(len(chunk), d=1.0 / sample_rate)
            te_fft = float(np.sum(fft_mag_sq))

            if te_fft > 0:
                sub_ratio = float(np.sum(fft_mag_sq[fft_freqs <= 80]) / te_fft)
                mid_presence = float(np.sum(fft_mag_sq[(fft_freqs >= 500) & (fft_freqs <= 2000)]) / te_fft)
            else:
                sub_ratio = 0.0
                mid_presence = 0.0

            # Spectral contrast: log peak/valley ratio per band
            band_defs = [(0, 200), (200, 800), (800, 3200), (3200, int(sample_rate // 2))]
            sc_vals = []
            fft_mags = np.sqrt(np.maximum(fft_mag_sq, 0.0))
            for f_lo, f_hi in band_defs:
                mask = (fft_freqs >= f_lo) & (fft_freqs < f_hi)
                if np.any(mask):
                    bv = fft_mags[mask]
                    n_valley = max(1, len(bv) // 10)
                    peak = float(np.max(bv))
                    valley = float(np.mean(np.sort(bv)[:n_valley]))
                    sc_vals.append(np.log1p(peak) - np.log1p(valley))
            spectral_contrast = float(np.mean(sc_vals)) if sc_vals else 0.0

            # Onset strength via Essentia OnsetRate
            try:
                onset_rate_algo = es.OnsetRate()
                _, onset_rate_val = onset_rate_algo(audio_arr)
                onset_strength = float(min(float(onset_rate_val) / 10.0, 1.0))
            except Exception as oe:
                logger.warning(f"OnsetRate failed: {oe}, using ZCR proxy")
                onset_strength = float(min(zero_crossing_rate * 3.0, 1.0))

        else:
            # ── Librosa fallback path ──────────────────────────────────────
            logger.info("Using Librosa for analysis")
            import librosa

            y, sr = librosa.load(tmp_path, sr=None, mono=True)
            duration = float(librosa.get_duration(y=y, sr=sr))

            # BPM + Key only for full tracks
            if not request.is_preview:
                tempo_arr, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
                bpm = float(np.atleast_1d(tempo_arr)[0])

                # Tempo stability from inter-beat intervals
                if len(beat_frames) > 2:
                    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
                    ibis = np.diff(beat_times)
                    ibi_mean = float(np.mean(ibis))
                    ibi_std = float(np.std(ibis))
                    tempo_stability = float(max(0.0, min(1.0, 1.0 - ibi_std / ibi_mean))) if ibi_mean > 0 else 0.5
                else:
                    tempo_stability = 0.5

                # Key detection
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
                tempo_stability = 0.5  # neutral for preview

            # Energy + LUFS approximation
            rms = librosa.feature.rms(y=y)[0]
            energy = float(np.mean(rms))
            lufs = -14.0 - (energy * 10.0)

            # Spectral features
            spectral_centroids = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            spectral_rolloffs = librosa.feature.spectral_rolloff(y=y, sr=sr)[0]
            spectral_centroid = float(np.mean(spectral_centroids))
            spectral_rolloff = float(np.mean(spectral_rolloffs))

            # Zero crossing rate
            zcr = librosa.feature.zero_crossing_rate(y)[0]
            zero_crossing_rate = float(np.mean(zcr))

            # MFCC
            mfccs = librosa.feature.mfcc(y=y, sr=sr, n_mfcc=13)
            mfcc_mean = [float(np.mean(mfccs[i])) for i in range(13)]

            # ── NEW: Band energy ratios via STFT ──────────────────────────
            D_sq = np.abs(librosa.stft(y, n_fft=4096, hop_length=2048)) ** 2
            freqs_lib = librosa.fft_frequencies(sr=sr, n_fft=4096)
            te_lib = float(np.sum(D_sq))

            if te_lib > 0:
                sub_ratio = float(np.sum(D_sq[freqs_lib <= 80, :]) / te_lib)
                mid_mask = (freqs_lib >= 500) & (freqs_lib <= 2000)
                mid_presence = float(np.sum(D_sq[mid_mask, :]) / te_lib)
            else:
                sub_ratio = 0.0
                mid_presence = 0.0

            # Spectral contrast
            sc_arr = librosa.feature.spectral_contrast(y=y, sr=sr)
            spectral_contrast = float(np.mean(sc_arr))

            # Onset strength (normalized to 0-1; raw values typically 0-20)
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            onset_strength = float(min(float(np.mean(onset_env)) / 10.0, 1.0))

        # ── Generate 64-dim embedding (shared for both paths) ────────────
        # Composition:
        #   [0-25]  13 MFCCs × 2 (value + pseudo-std)  = 26 dims
        #   [26-29] spectral shape (centroid, rolloff, zcr, energy) = 4 dims
        #   [30]    LUFS normalized                       = 1 dim
        #   [31]    BPM normalized (0 for preview)        = 1 dim
        #   [32]    tempo_stability                       = 1 dim
        #   [33]    sub_ratio                             = 1 dim
        #   [34]    mid_presence                          = 1 dim
        #   [35]    onset_strength                        = 1 dim
        #   [36]    spectral_contrast normalized          = 1 dim
        #   [37]    duration normalized                   = 1 dim
        #   [38-63] padding zeros                         = 26 dims
        # NOTE: key/scale intentionally excluded — key doesn't influence label choice

        embedding = []
        # MFCCs (26 dims)
        for i in range(min(13, len(mfcc_mean))):
            embedding.append(float(mfcc_mean[i]))
            embedding.append(float(mfcc_mean[i]) * 0.5)  # pseudo-std
        # Spectral shape (4 dims)
        embedding.append(float(spectral_centroid) / 8000.0)
        embedding.append(float(spectral_rolloff) / 16000.0)
        embedding.append(float(zero_crossing_rate))
        embedding.append(float(energy))
        # Loudness (1 dim): map -30..0 LUFS → 0..1
        embedding.append(float(max(0.0, min(1.0, (float(lufs) + 30.0) / 30.0))))
        # Rhythm (2 dims)
        embedding.append(float(bpm) / 200.0 if bpm is not None else 0.0)
        embedding.append(float(tempo_stability))
        # Band ratios (2 dims)
        embedding.append(float(sub_ratio))
        embedding.append(float(mid_presence))
        # Transients + contrast (2 dims)
        embedding.append(float(onset_strength))
        embedding.append(float(min(1.0, max(0.0, float(spectral_contrast) / 5.0))))
        # Duration (1 dim)
        embedding.append(float(duration) / 300.0)

        # Pad to 64
        while len(embedding) < 64:
            embedding.append(0.0)
        embedding = embedding[:64]

        # L2 normalize
        emb_array = np.array(embedding, dtype=np.float32)
        norm = float(np.linalg.norm(emb_array))
        if norm > 0:
            emb_array = emb_array / norm
        embedding = emb_array.tolist()

        analysis_type = "preview" if request.is_preview else "full"
        logger.info(
            f"Analysis complete: type={analysis_type}, BPM={bpm or 'N/A'}, "
            f"sub_ratio={sub_ratio:.3f}, onset={onset_strength:.3f}, "
            f"mid={mid_presence:.3f}, stability={tempo_stability:.3f}, "
            f"contrast={spectral_contrast:.3f}"
        )

        return AnalysisResponse(
            track_id=request.track_id,
            features=TrackFeatures(
                bpm=bpm,
                key=key,
                scale=scale,
                energy=float(energy),
                lufs=float(lufs),
                duration=float(duration),
                spectral_centroid=float(spectral_centroid),
                spectral_rolloff=float(spectral_rolloff),
                zero_crossing_rate=float(zero_crossing_rate),
                sub_ratio=float(sub_ratio),
                onset_strength=float(onset_strength),
                mid_presence=float(mid_presence),
                tempo_stability=float(tempo_stability),
                spectral_contrast=float(spectral_contrast),
                mfcc_mean=mfcc_mean,
                embedding=embedding,
                analysis_type=analysis_type,
            ),
            success=True,
        )

    except Exception as e:
        logger.error(f"Analysis failed: {str(e)}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            logger.info("Cleaned up temp file")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
