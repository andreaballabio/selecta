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

app = FastAPI(title="Selecta Worker", version="4.0.0")

ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class TrackFeatures(BaseModel):
    # --- Ritmo (solo full track) ---
    bpm: Optional[float] = None
    key: Optional[str] = None
    scale: Optional[str] = None

    # --- Dinamica ---
    energy: float
    lufs: float
    duration: float

    # --- Timbrica base ---
    spectral_centroid: float        # brightness media del brano
    spectral_rolloff: float         # dove si concentra l'energia in frequenza
    zero_crossing_rate: float       # texture: smooth vs distorto/noisy
    spectral_contrast: float        # definizione produzione (picchi vs valli spettrali)

    # --- Feature stilistiche ---
    onset_strength: float           # aggressività groove / punch del kick (0-1)
    sub_ratio: float                # peso del sub (sotto 80Hz) sul totale
    mid_presence: float             # presenza mid (300-3000Hz)
    tempo_stability: float          # rigidità del groove (0=libero, 1=locked)

    # --- Vettori ---
    mfcc_mean: List[float]          # 13 coefficienti MFCC medi su tutto il brano
    embedding: List[float]          # vettore normalizzato per cosine similarity
    embeddings: Optional[List[List[float]]] = None  # sliding-window (solo full track)

    analysis_type: str = "full"     # "preview" | "full"


class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    is_preview: bool = False
    track_status: str = "unknown"   # "demo" | "mixed" | "mastered" | "unknown"


class AnalysisResponse(BaseModel):
    track_id: str
    features: Optional[TrackFeatures] = None
    success: bool = True
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def compute_sub_ratio(y: np.ndarray, sr: int) -> float:
    """Rapporto energia sotto 80Hz sul totale (stima via FFT)."""
    try:
        fft = np.abs(np.fft.rfft(y))
        freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
        sub_energy = np.sum(fft[freqs < 80] ** 2)
        total_energy = np.sum(fft ** 2)
        return float(sub_energy / total_energy) if total_energy > 0 else 0.0
    except Exception:
        return 0.0


def compute_mid_presence(y: np.ndarray, sr: int) -> float:
    """Rapporto energia 300-3000Hz sul totale."""
    try:
        fft = np.abs(np.fft.rfft(y))
        freqs = np.fft.rfftfreq(len(y), d=1.0 / sr)
        mid_energy = np.sum(fft[(freqs >= 300) & (freqs <= 3000)] ** 2)
        total_energy = np.sum(fft ** 2)
        return float(mid_energy / total_energy) if total_energy > 0 else 0.0
    except Exception:
        return 0.0


def compute_spectral_contrast_librosa(y: np.ndarray, sr: int) -> float:
    """
    Contrasto spettrale medio — misura quanto sono definiti e separati
    i diversi strati della produzione (kick, basso, synth).
    Valore alto = produzione pulita e definita.
    Normalizzato in [0, 1].
    """
    try:
        import librosa
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
        mean_contrast = float(np.mean(contrast))
        # Valori tipici tra 0 e 40 dB
        return float(np.clip(mean_contrast / 40.0, 0.0, 1.0))
    except Exception:
        return 0.0


def normalize_onset_strength_essentia(energy_arr: np.ndarray) -> float:
    """
    Calcola onset strength da array di energie per frame (Essentia).
    Le energie Essentia sono valori assoluti (es. 300-400), quindi
    normalizziamo prima rispetto al massimo, poi calcoliamo le differenze.
    Output in [0, 1].
    """
    if len(energy_arr) < 2:
        return 0.0
    max_e = float(np.max(energy_arr))
    if max_e == 0:
        return 0.0
    energy_norm = energy_arr / max_e
    diffs = np.abs(np.diff(energy_norm))
    raw = float(np.mean(diffs))
    # Valori tipici dopo normalizzazione: 0.01-0.15 per tech house
    normalized = raw / 0.08
    return float(np.clip(normalized, 0.0, 1.0))


def normalize_onset_strength_librosa(onset_env: np.ndarray) -> float:
    """
    Normalizza onset_strength da Librosa.
    Usa il 95° percentile come riferimento invece di dividere per 10.
    Output in [0, 1].
    """
    if len(onset_env) == 0:
        return 0.0
    p95 = float(np.percentile(onset_env, 95))
    if p95 == 0:
        return 0.0
    normalized = float(np.mean(onset_env)) / p95
    return float(np.clip(normalized, 0.0, 1.0))


def median_of_windows(values: List[float]) -> float:
    """Mediana di una lista di valori float."""
    if not values:
        return 0.0
    return float(np.median(values))


def split_audio_windows(audio: np.ndarray, sr: int, n_windows: int = 3) -> List[np.ndarray]:
    """
    Divide l'audio in n_windows segmenti uguali.
    Usato per preview: ogni segmento viene analizzato separatamente
    e i valori mediati, riducendo l'impatto di intro/outro silenziosi.
    """
    total = len(audio)
    window_size = total // n_windows
    windows = []
    for i in range(n_windows):
        start = i * window_size
        end = start + window_size if i < n_windows - 1 else total
        windows.append(audio[start:end])
    return windows


def build_embedding(
    mfcc_mean: List[float],
    spectral_centroid_norm: float,
    spectral_rolloff_norm: float,
    zero_crossing_rate: float,
    energy: float,
    onset_strength: float,
    sub_ratio: float,
    mid_presence: float,
    tempo_stability: float,
    spectral_contrast: float,
) -> List[float]:
    """
    Embedding stilistico a 64 dimensioni.
    NON include BPM o chiave.

    Layout:
      [0:13]  MFCC mean (13 valori)
      [13:26] MFCC mean * 0.5
      [26]    spectral_centroid normalizzato
      [27]    spectral_rolloff normalizzato
      [28]    zero_crossing_rate
      [29]    energy
      [30]    onset_strength
      [31]    sub_ratio
      [32]    mid_presence
      [33]    tempo_stability
      [34]    spectral_contrast
      [35:64] padding 0.0
    """
    emb = []

    for v in mfcc_mean[:13]:
        emb.append(float(v))
    for v in mfcc_mean[:13]:
        emb.append(float(v) * 0.5)

    emb.append(spectral_centroid_norm)
    emb.append(spectral_rolloff_norm)
    emb.append(float(zero_crossing_rate))
    emb.append(float(energy))
    emb.append(float(onset_strength))
    emb.append(float(sub_ratio))
    emb.append(float(mid_presence))
    emb.append(float(tempo_stability))
    emb.append(float(spectral_contrast))

    while len(emb) < 64:
        emb.append(0.0)
    emb = emb[:64]

    arr = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()


# ---------------------------------------------------------------------------
# Analisi con Essentia
# ---------------------------------------------------------------------------

def analyze_with_essentia(audio_mono: np.ndarray, audio_stereo: np.ndarray,
                           sample_rate: int, is_preview: bool):
    import essentia.standard as es

    duration = len(audio_mono) / sample_rate
    frame_size = 2048
    hop_size = 512

    # BPM e chiave solo su full track
    if not is_preview:
        bpm = float(es.RhythmExtractor2013()(audio_mono)[0])
        key, scale, _ = es.KeyExtractor()(audio_mono)
    else:
        bpm, key, scale = None, None, None

    # LUFS
    _, _, lufs, _ = es.LoudnessEBUR128()(audio_stereo)
    lufs = float(lufs)

    def _extract_frame_features(audio_segment: np.ndarray):
        energies, centroids, rolloffs, zcrs, mfcc_frames = [], [], [], [], []
        spectrum_algo = es.Spectrum(size=frame_size)
        centroid_algo = es.Centroid(range=sample_rate / 2)
        rolloff_algo = es.RollOff()
        mfcc_algo = es.MFCC(numberCoefficients=13)

        for frame in es.FrameGenerator(audio_segment, frameSize=frame_size, hopSize=hop_size):
            windowed = es.Windowing(type='hann')(frame)
            spec = spectrum_algo(windowed)
            energies.append(es.Energy()(frame))
            centroids.append(centroid_algo(spec))
            rolloffs.append(rolloff_algo(spec))
            zcrs.append(es.ZeroCrossingRate()(frame))
            _, mfcc_coeffs = mfcc_algo(spec)
            mfcc_frames.append(mfcc_coeffs)

        return energies, centroids, rolloffs, zcrs, mfcc_frames

    if is_preview:
        # Analisi a finestre: 3 segmenti, mediana dei valori
        windows = split_audio_windows(audio_mono, sample_rate, n_windows=3)
        w_energy, w_centroid, w_rolloff, w_zcr, w_onset, w_mfcc = [], [], [], [], [], []

        for w in windows:
            if len(w) < frame_size:
                continue
            e, c, r, z, m = _extract_frame_features(w)
            if not e:
                continue
            w_energy.append(float(np.mean(e)))
            w_centroid.append(float(np.mean(c)))
            w_rolloff.append(float(np.mean(r)))
            w_zcr.append(float(np.mean(z)))
            w_onset.append(normalize_onset_strength_essentia(np.array(e)))
            w_mfcc.append([float(np.mean([f[i] for f in m])) for i in range(13)])

        energy = median_of_windows(w_energy)
        spectral_centroid = median_of_windows(w_centroid)
        spectral_rolloff = median_of_windows(w_rolloff)
        zero_crossing_rate = median_of_windows(w_zcr)
        onset_strength = median_of_windows(w_onset)
        mfcc_mean = (
            [float(np.median([w[i] for w in w_mfcc])) for i in range(13)]
            if w_mfcc else [0.0] * 13
        )

    else:
        energies, centroids, rolloffs, zcrs, mfcc_frames = _extract_frame_features(audio_mono)
        energy = float(np.mean(energies))
        spectral_centroid = float(np.mean(centroids))
        spectral_rolloff = float(np.mean(rolloffs))
        zero_crossing_rate = float(np.mean(zcrs))
        onset_strength = normalize_onset_strength_essentia(np.array(energies))
        mfcc_mean = [float(np.mean([f[i] for f in mfcc_frames])) for i in range(13)]

    # Tempo stability (solo full track)
    if not is_preview and bpm and bpm > 0:
        beats = es.RhythmExtractor2013()(audio_mono)[1]
        if len(beats) > 2:
            intervals = np.diff(beats)
            expected = 60.0 / bpm
            stability = 1.0 - min(float(np.std(intervals) / expected), 1.0)
        else:
            stability = 0.5
    else:
        stability = 0.5

    y_np = audio_mono.astype(np.float32)
    sub_ratio = compute_sub_ratio(y_np, sample_rate)
    mid_presence = compute_mid_presence(y_np, sample_rate)
    spectral_contrast = compute_spectral_contrast_librosa(y_np, sample_rate)

    return dict(
        bpm=bpm, key=key, scale=scale,
        energy=energy, lufs=lufs, duration=duration,
        spectral_centroid=spectral_centroid,
        spectral_rolloff=spectral_rolloff,
        zero_crossing_rate=zero_crossing_rate,
        onset_strength=onset_strength,
        sub_ratio=sub_ratio,
        mid_presence=mid_presence,
        tempo_stability=stability,
        spectral_contrast=spectral_contrast,
        mfcc_mean=mfcc_mean,
        sample_rate=sample_rate,
    )


# ---------------------------------------------------------------------------
# Analisi con Librosa (fallback)
# ---------------------------------------------------------------------------

def analyze_with_librosa(audio: np.ndarray, sr: int, is_preview: bool):
    import librosa

    duration = librosa.get_duration(y=audio, sr=sr)
    logger.info(f"Librosa — {len(audio)} samples @ {sr}Hz")

    if not is_preview:
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        bpm = float(tempo)
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        key_names = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
        key_idx = int(np.argmax(chroma_mean))
        key = key_names[key_idx]
        scale = 'minor' if chroma_mean[(key_idx + 3) % 12] > chroma_mean[key_idx] * 0.7 else 'major'
    else:
        bpm, key, scale = None, None, None

    def _extract_segment_features(y_seg: np.ndarray):
        rms = librosa.feature.rms(y=y_seg)[0]
        energy = float(np.mean(rms))
        lufs_approx = -14.0 - (energy * 10.0)
        sc = float(np.mean(librosa.feature.spectral_centroid(y=y_seg, sr=sr)[0]))
        sro = float(np.mean(librosa.feature.spectral_rolloff(y=y_seg, sr=sr)[0]))
        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y_seg)[0]))
        mfccs = librosa.feature.mfcc(y=y_seg, sr=sr, n_mfcc=13)
        mfcc_mean = [float(np.mean(mfccs[i])) for i in range(13)]
        onset_env = librosa.onset.onset_strength(y=y_seg, sr=sr)
        onset = normalize_onset_strength_librosa(onset_env)
        return energy, lufs_approx, sc, sro, zcr, mfcc_mean, onset

    if is_preview:
        windows = split_audio_windows(audio, sr, n_windows=3)
        w_energy, w_lufs, w_sc, w_sro, w_zcr, w_onset, w_mfcc = [], [], [], [], [], [], []

        for w in windows:
            if len(w) < 2048:
                continue
            e, l, sc, sro, zcr, mfcc, onset = _extract_segment_features(w)
            w_energy.append(e)
            w_lufs.append(l)
            w_sc.append(sc)
            w_sro.append(sro)
            w_zcr.append(zcr)
            w_onset.append(onset)
            w_mfcc.append(mfcc)

        energy = median_of_windows(w_energy)
        lufs = median_of_windows(w_lufs)
        spectral_centroid = median_of_windows(w_sc)
        spectral_rolloff = median_of_windows(w_sro)
        zero_crossing_rate = median_of_windows(w_zcr)
        onset_strength = median_of_windows(w_onset)
        mfcc_mean = (
            [float(np.median([w[i] for w in w_mfcc])) for i in range(13)]
            if w_mfcc else [0.0] * 13
        )

    else:
        energy, lufs, spectral_centroid, spectral_rolloff, zero_crossing_rate, mfcc_mean, onset_strength = \
            _extract_segment_features(audio)

    # Tempo stability (solo full track)
    if not is_preview and bpm and bpm > 0:
        _, beats = librosa.beat.beat_track(y=audio, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
        if len(beat_times) > 2:
            intervals = np.diff(beat_times)
            expected = 60.0 / bpm
            stability = 1.0 - min(float(np.std(intervals) / expected), 1.0)
        else:
            stability = 0.5
    else:
        stability = 0.5

    sub_ratio = compute_sub_ratio(audio, sr)
    mid_presence = compute_mid_presence(audio, sr)
    spectral_contrast = compute_spectral_contrast_librosa(audio, sr)

    return dict(
        bpm=bpm, key=key, scale=scale,
        energy=energy, lufs=lufs, duration=duration,
        spectral_centroid=spectral_centroid,
        spectral_rolloff=spectral_rolloff,
        zero_crossing_rate=zero_crossing_rate,
        onset_strength=onset_strength,
        sub_ratio=sub_ratio,
        mid_presence=mid_presence,
        tempo_stability=stability,
        spectral_contrast=spectral_contrast,
        mfcc_mean=mfcc_mean,
        sample_rate=sr,
    )


# ---------------------------------------------------------------------------
# Sliding-window embeddings (full track → multiple 30s windows)
# ---------------------------------------------------------------------------

def compute_sliding_window_embeddings(
    audio: np.ndarray,
    sr: int,
    window_sec: float = 30.0,
    stride_sec: float = 5.0,
) -> List[List[float]]:
    """
    Divide la traccia intera in finestre sovrapposte da 30s (stride 5s).
    Tutte le feature frame-level vengono calcolate in un solo passaggio
    sull'intera traccia per efficienza, poi aggregate per ogni finestra.

    Una traccia da 6 min produce ~66 embedding, uno per finestra.
    Il match route userà il MAX di similarità coseno su tutte le finestre,
    confrontando così "drop contro drop" invece di "traccia intera contro preview".
    """
    import librosa

    hop_length = 512
    window_samples = int(window_sec * sr)
    audio_f = audio.astype(np.float32)

    # Traccia più corta di una finestra → analizza come preview (3 segmenti)
    if len(audio_f) <= window_samples:
        feat = analyze_with_librosa(audio_f, sr, is_preview=True)
        feat.pop("sample_rate")
        return [build_embedding(
            mfcc_mean=feat["mfcc_mean"],
            spectral_centroid_norm=min(feat["spectral_centroid"] / (sr / 2), 1.0),
            spectral_rolloff_norm=min(feat["spectral_rolloff"] / (sr / 2), 1.0),
            zero_crossing_rate=feat["zero_crossing_rate"],
            energy=feat["energy"],
            onset_strength=feat["onset_strength"],
            sub_ratio=feat["sub_ratio"],
            mid_presence=feat["mid_presence"],
            tempo_stability=feat["tempo_stability"],
            spectral_contrast=feat["spectral_contrast"],
        )]

    # ── Calcolo frame-level in un unico passaggio ──────────────────────────
    mfccs      = librosa.feature.mfcc(y=audio_f, sr=sr, n_mfcc=13, hop_length=hop_length)
    sc_frames  = librosa.feature.spectral_centroid(y=audio_f, sr=sr, hop_length=hop_length)[0]
    sro_frames = librosa.feature.spectral_rolloff(y=audio_f, sr=sr, hop_length=hop_length)[0]
    zcr_frames = librosa.feature.zero_crossing_rate(audio_f, hop_length=hop_length)[0]
    rms_frames = librosa.feature.rms(y=audio_f, hop_length=hop_length)[0]
    onset_env  = librosa.onset.onset_strength(y=audio_f, sr=sr, hop_length=hop_length)

    # STFT condiviso per sub_ratio, mid_presence, spectral_contrast
    stft_mag  = np.abs(librosa.stft(audio_f, n_fft=2048, hop_length=hop_length))
    freqs     = librosa.fft_frequencies(sr=sr, n_fft=2048)
    total_pwr = np.sum(stft_mag ** 2, axis=0)
    sub_pwr   = np.sum(stft_mag[freqs < 80, :] ** 2, axis=0)
    mid_pwr   = np.sum(stft_mag[(freqs >= 300) & (freqs <= 3000), :] ** 2, axis=0)
    sub_f     = np.where(total_pwr > 0, sub_pwr   / total_pwr, 0.0)
    mid_f     = np.where(total_pwr > 0, mid_pwr   / total_pwr, 0.0)
    con_f     = librosa.feature.spectral_contrast(S=stft_mag, sr=sr, n_bands=6)  # (7, N)

    # ── Aggregazione per finestra ──────────────────────────────────────────
    total_frames    = mfccs.shape[1]
    frames_per_win  = int(window_sec  * sr / hop_length)
    frames_per_step = max(1, int(stride_sec * sr / hop_length))

    embeddings: List[List[float]] = []
    f0 = 0
    while f0 + frames_per_win <= total_frames:
        f1 = f0 + frames_per_win
        emb = build_embedding(
            mfcc_mean=[float(np.mean(mfccs[i, f0:f1])) for i in range(13)],
            spectral_centroid_norm=min(float(np.mean(sc_frames[f0:f1]))  / (sr / 2), 1.0),
            spectral_rolloff_norm= min(float(np.mean(sro_frames[f0:f1])) / (sr / 2), 1.0),
            zero_crossing_rate=float(np.mean(zcr_frames[f0:f1])),
            energy=float(np.mean(rms_frames[f0:f1])),
            onset_strength=normalize_onset_strength_librosa(onset_env[f0:f1]),
            sub_ratio=float(np.mean(sub_f[f0:f1])),
            mid_presence=float(np.mean(mid_f[f0:f1])),
            tempo_stability=0.5,  # troppo costoso per ogni finestra
            spectral_contrast=float(np.clip(np.mean(con_f[:, f0:f1]) / 40.0, 0.0, 1.0)),
        )
        embeddings.append(emb)
        f0 += frames_per_step

    return embeddings or [build_embedding(
        mfcc_mean=[0.0] * 13, spectral_centroid_norm=0.5, spectral_rolloff_norm=0.5,
        zero_crossing_rate=0.0, energy=0.0, onset_strength=0.0,
        sub_ratio=0.0, mid_presence=0.0, tempo_stability=0.5, spectral_contrast=0.0,
    )]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "4.0.0"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_track(request: AnalysisRequest):
    tmp_path = None
    try:
        logger.info(f"Analyzing: {request.track_id} | preview={request.is_preview} | status={request.track_status}")

        async with httpx.AsyncClient() as client:
            response = await client.get(request.file_url, timeout=60.0)
            response.raise_for_status()
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name
            logger.info(f"Downloaded {len(response.content)} bytes → {tmp_path}")

        # Carica audio una sola volta
        audio_mono: np.ndarray
        try:
            import essentia.standard as es
            logger.info("Using Essentia")
            loader = es.AudioLoader(filename=tmp_path)
            audio_stereo, sample_rate, _, _, _, _ = loader()
            audio_mono = np.mean(audio_stereo, axis=1)
            feat = analyze_with_essentia(audio_mono, audio_stereo, sample_rate, request.is_preview)
        except ImportError:
            logger.warning("Essentia not available, falling back to Librosa")
            import librosa
            audio_mono, sample_rate = librosa.load(tmp_path, sr=None, mono=True)
            feat = analyze_with_librosa(audio_mono, sample_rate, request.is_preview)

        sr = feat.pop("sample_rate")
        sc_norm = min(feat["spectral_centroid"] / (sr / 2), 1.0)
        sr_norm = min(feat["spectral_rolloff"] / (sr / 2), 1.0)

        embedding = build_embedding(
            mfcc_mean=feat["mfcc_mean"],
            spectral_centroid_norm=sc_norm,
            spectral_rolloff_norm=sr_norm,
            zero_crossing_rate=feat["zero_crossing_rate"],
            energy=feat["energy"],
            onset_strength=feat["onset_strength"],
            sub_ratio=feat["sub_ratio"],
            mid_presence=feat["mid_presence"],
            tempo_stability=feat["tempo_stability"],
            spectral_contrast=feat["spectral_contrast"],
        )

        # Sliding-window embeddings solo per tracce intere (non preview)
        # Divide la traccia in ~60-70 finestre da 30s (stride 5s) per confrontarle
        # direttamente con le preview Deezer/Spotify del catalogo.
        embeddings_list: Optional[List[List[float]]] = None
        if not request.is_preview:
            logger.info(f"Computing sliding-window embeddings (30s window, 5s stride)...")
            embeddings_list = compute_sliding_window_embeddings(audio_mono, sr)
            logger.info(f"Generated {len(embeddings_list)} window embeddings")

        analysis_type = "preview" if request.is_preview else "full"
        logger.info(
            f"Done — type={analysis_type} BPM={feat['bpm']} "
            f"sub={feat['sub_ratio']:.3f} mid={feat['mid_presence']:.3f} "
            f"onset={feat['onset_strength']:.3f} stability={feat['tempo_stability']:.3f} "
            f"contrast={feat['spectral_contrast']:.3f}"
        )

        return AnalysisResponse(
            track_id=request.track_id,
            features=TrackFeatures(
                bpm=feat["bpm"],
                key=feat["key"],
                scale=feat["scale"],
                energy=feat["energy"],
                lufs=feat["lufs"],
                duration=feat["duration"],
                spectral_centroid=feat["spectral_centroid"],
                spectral_rolloff=feat["spectral_rolloff"],
                zero_crossing_rate=feat["zero_crossing_rate"],
                onset_strength=feat["onset_strength"],
                sub_ratio=feat["sub_ratio"],
                mid_presence=feat["mid_presence"],
                tempo_stability=feat["tempo_stability"],
                spectral_contrast=feat["spectral_contrast"],
                mfcc_mean=feat["mfcc_mean"],
                embedding=embedding,
                embeddings=embeddings_list,
                analysis_type=analysis_type,
            ),
            success=True,
        )

    except httpx.HTTPStatusError as e:
        # CDN ha risposto con un errore HTTP (es. 403 = URL scaduto)
        # Restituiamo HTTP 200 con success=False invece di 500, così il chiamante
        # può gestirlo senza dover fare parsing del body dell'errore.
        status_code = e.response.status_code
        logger.error(f"Analysis failed: CDN returned {status_code} for URL (preview likely expired)")
        return AnalysisResponse(
            track_id=request.track_id,
            features=None,
            success=False,
            error=f"CDN error {status_code}: preview URL expired or unavailable",
        )

    except Exception as e:
        logger.error(f"Analysis failed: {e}")
        import traceback
        logger.error(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            logger.info("Temp file cleaned up")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 7860))
    uvicorn.run(app, host="0.0.0.0", port=port)
