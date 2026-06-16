from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import os
import numpy as np
import httpx
import tempfile
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("selecta_worker")

app = FastAPI(title="Selecta Worker", version="6.0.0")

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
    spectral_centroid: float
    spectral_rolloff: float
    zero_crossing_rate: float
    spectral_contrast: float

    # --- Feature stilistiche ---
    onset_strength: float
    sub_ratio: float
    mid_presence: float
    tempo_stability: float

    # --- Vettori ---
    mfcc_mean: List[float]          # mantenuto per display/compatibilità
    embedding: List[float]          # 64-dim v6 embedding
    embeddings: Optional[List[List[float]]] = None  # sliding-window (solo full track)

    analysis_type: str = "full"     # "preview" | "full"


class AnalysisRequest(BaseModel):
    track_id: str
    file_url: str
    is_preview: bool = False
    track_status: str = "unknown"


class AnalysisResponse(BaseModel):
    track_id: str
    features: Optional[TrackFeatures] = None
    success: bool = True
    error: Optional[str] = None


# ===========================================================================
#  EMBEDDING v6 — "timbre signature + style discriminators"
# ===========================================================================
#
#  Perché v6 (vs v5):
#  - v4 usava la MEDIA MFCC come ~tutto l'embedding: ottima come "firma"
#    della singola registrazione (riconosceva il titolo!) ma con magnitudini
#    ±100 dominava la L2-norm → tutte le tracce stesso-genere a cosine 0.98.
#  - v5 ha rimosso del tutto la media MFCC e usato solo std+delta (variazione
#    temporale). Ha perso la capacità di riconoscere la traccia esatta:
#    std/delta descrivono lo *stile di variazione*, non l'identità del suono.
#  - v6 reintroduce la FIRMA TIMBRICA come DIREZIONE della media MFCC
#    (vettore unitario dei coeff 1-12, zero-centrato, range ~[-1,1]) — niente
#    calibrazione di magnitudine da indovinare, quindi niente clipping —
#    AFFIANCATA ai discriminatori di stile (std, delta, bande, percussione).
#
#  Tutte le feature di magnitudine sono normalizzate in [0,1] prima della
#  L2-norm finale → contributo bilanciato. La firma timbrica resta zero-centrata
#  così da poter ABBASSARE la similarità tra tracce diverse dello stesso genere
#  (è il meccanismo che separa "stesso pezzo" da "stesso genere").
#
#  Layout (64 dim, nessuna migrazione DB):
#    [0:12]   firma timbrica  — direzione media MFCC coeff 1-12   (~[-1,1])
#    [12:25]  MFCC std (13)   — variazione temporale del timbro    [0,1]
#    [25:38]  |Δ MFCC| (13)   — velocità di cambio (groove)        [0,1]
#    [38:44]  bande freq (6)  — sub/kick/snare/hi-mid/hat/aria     [0,1]
#    [44:47]  percussione     — onset_rate, onset_std, crest       [0,1]
#    [47:49]  spectral flux   — mean, std                          [0,1]
#    [49:55]  scalari (6)     — sub, mid, onset, contrast, zcr, centroid
#    [55:64]  padding 0.0 (9)
# ---------------------------------------------------------------------------

# Fattori di normalizzazione calibrati su dati reali Essentia (2026-05-29):
# full-track techno → mfcc_std[0]≈102, delta[0]≈29. Le finestre da 30s
# (catalogo + sliding) valgono ~70-85% del full-track → questi MAX danno
# valori tipici ~0.5-0.65 (no clipping). Ricalibrare se i log mostrano
# valori stabilmente a 1.0 (alza il MAX) o <0.1 (abbassa il MAX).
MFCC_STD_MAX = [120.0, 70.0, 55.0, 45.0, 38.0, 32.0, 28.0, 24.0, 20.0, 17.0, 14.0, 12.0, 10.0]
DELTA_MAX    = [ 50.0, 30.0, 24.0, 20.0, 16.0, 13.0, 12.0, 10.0,  8.0,  7.0,  5.0,  4.0,  4.0]

# Peso per gruppo applicato PRIMA della L2-norm finale (knob di tuning).
# 1.0 = contributo neutro. Alza TIMBRE per dare più peso al riconoscimento
# della traccia esatta; alza PERC/BANDS per dare più peso ai drums.
W_TIMBRE = 1.30   # firma timbrica (riconoscimento traccia)
W_STD    = 1.00
W_DELTA  = 1.00
W_BANDS  = 1.15   # drums / bilanciamento del mix (richiesta esplicita utente)
W_PERC   = 1.15   # percussione
W_FLUX   = 0.80
W_SCALAR = 1.00


def _clip01(v: float) -> float:
    return float(np.clip(v, 0.0, 1.0))


def build_embedding(
    mfcc_mean: List[float],         # 13 — media MFCC (ne usiamo la direzione 1-12)
    mfcc_std: List[float],          # 13
    delta_mfcc: List[float],        # 13
    band_energies: List[float],     # 6
    onset_rate: float,
    onset_std: float,
    crest_factor: float,
    flux_mean: float,
    flux_std: float,
    sub_ratio: float,
    mid_presence: float,
    onset_strength: float,
    spectral_contrast: float,
    zcr_norm: float,
    centroid_norm: float,
) -> List[float]:
    emb: List[float] = []

    # [0:12] FIRMA TIMBRICA — direzione (vettore unitario) della media MFCC,
    # coefficienti 1-12 (si scarta il coeff 0 = energia globale, poco timbrico).
    # Zero-centrata: stessa registrazione → stessa direzione → forte similarità;
    # tracce diverse → direzioni diverse → similarità abbassata. Nessuna
    # magnitudine da calibrare ⇒ nessun rischio di clipping.
    shape = np.array(mfcc_mean[1:13], dtype=np.float64)
    if shape.shape[0] < 12:
        shape = np.pad(shape, (0, 12 - shape.shape[0]))
    snorm = float(np.linalg.norm(shape))
    if snorm > 0:
        shape = shape / snorm
    for v in shape[:12]:
        emb.append(float(v) * W_TIMBRE)

    # [12:25] MFCC std
    for i, v in enumerate(mfcc_std[:13]):
        emb.append(_clip01(v / MFCC_STD_MAX[i]) * W_STD)

    # [25:38] |Delta-MFCC|
    for i, v in enumerate(delta_mfcc[:13]):
        emb.append(_clip01(v / DELTA_MAX[i]) * W_DELTA)

    # [38:44] Band energies (già rapporti [0,1])
    for v in band_energies[:6]:
        emb.append(_clip01(v) * W_BANDS)

    # [44:47] Percussione
    emb.append(_clip01(onset_rate / 16.0) * W_PERC)             # 0-16 onset/sec
    emb.append(_clip01(onset_std) * W_PERC)
    emb.append(_clip01((crest_factor - 1.0) / 8.0) * W_PERC)    # crest 1-9 → [0,1]

    # [47:49] Spectral flux
    emb.append(_clip01(flux_mean * 150.0) * W_FLUX)
    emb.append(_clip01(flux_std * 150.0) * W_FLUX)

    # [49:55] Scalari
    emb.append(_clip01(sub_ratio) * W_SCALAR)
    emb.append(_clip01(mid_presence) * W_SCALAR)
    emb.append(_clip01(onset_strength) * W_SCALAR)
    emb.append(_clip01(spectral_contrast) * W_SCALAR)
    emb.append(_clip01(zcr_norm / 0.3) * W_SCALAR)
    emb.append(_clip01(centroid_norm) * W_SCALAR)

    # Pad to 64
    while len(emb) < 64:
        emb.append(0.0)
    emb = emb[:64]

    arr = np.array(emb, dtype=np.float32)
    norm = np.linalg.norm(arr)
    if norm > 0:
        arr = arr / norm
    return arr.tolist()


def segment_kwargs(
    energies_a:  np.ndarray,
    mfcc_a:      np.ndarray,    # (n_frames, 13)
    band_a:      np.ndarray,    # (n_frames, 6)
    flux_a:      np.ndarray,    # (n_frames-1,)
    zcrs_a:      np.ndarray,
    centroids_a: np.ndarray,
    sample_rate: int,
    duration_sec: float,
    spectral_contrast: float,   # calcolato una volta per analisi (stabile)
) -> Dict[str, Any]:
    """
    Frame-level features di un SEGMENTO → kwargs di build_embedding.
    USATA IN MODO IDENTICO per: preview catalogo (intero preview ~30s) e
    sliding window utente (finestra 30s). Questo garantisce che catalogo e
    utente vivano nello STESSO spazio (il bug di v5 era median-di-3 vs 30s).
    Tutto (onset, sub, mid) è derivato qui dai frame → zero divergenze.
    """
    n = len(energies_a)

    mfcc_mean = np.mean(mfcc_a, axis=0).tolist() if n > 0 else [0.0] * 13
    mfcc_std  = np.std(mfcc_a, axis=0).tolist()  if n > 1 else [0.0] * 13

    if n > 1:
        delta_mfcc = np.mean(np.abs(np.diff(mfcc_a, axis=0)), axis=0).tolist()
    else:
        delta_mfcc = [0.0] * 13

    band_energies = np.mean(band_a, axis=0).tolist() if len(band_a) > 0 else [0.0] * 6

    # Onset rate / std dai picchi di energia
    onset_rate = 0.0
    onset_std  = 0.0
    if n > 1 and duration_sec > 0:
        diffs = np.diff(energies_a)
        pos = diffs[diffs > 0]
        if len(pos) > 0:
            threshold = float(np.median(pos)) * 2.0
            onset_rate = int(np.sum(pos > threshold)) / duration_sec
            max_d = float(np.max(pos)) + 1e-10
            onset_std = float(np.std(pos / max_d))

    # Crest factor
    crest_factor = 1.0
    if n > 0:
        peak_e = float(np.max(energies_a))
        mean_e = float(np.mean(energies_a)) + 1e-10
        crest_factor = max(1.0, peak_e / mean_e)

    flux_mean = float(np.mean(flux_a)) if len(flux_a) > 0 else 0.0
    flux_std  = float(np.std(flux_a))  if len(flux_a) > 0 else 0.0

    zcr_norm = float(np.mean(zcrs_a)) if len(zcrs_a) > 0 else 0.0
    centroid_norm = (
        _clip01(float(np.mean(centroids_a)) / (sample_rate / 2))
        if len(centroids_a) > 0 else 0.0
    )

    # sub/mid derivati dalle bande (coerenti con l'embedding)
    sub_ratio    = float(band_energies[0] + band_energies[1] * 0.3)
    mid_presence = float(band_energies[2] + band_energies[3] * 0.2)
    onset_strength = normalize_onset_strength_essentia(energies_a)

    return dict(
        mfcc_mean=mfcc_mean,
        mfcc_std=mfcc_std,
        delta_mfcc=delta_mfcc,
        band_energies=band_energies,
        onset_rate=onset_rate,
        onset_std=onset_std,
        crest_factor=crest_factor,
        flux_mean=flux_mean,
        flux_std=flux_std,
        sub_ratio=sub_ratio,
        mid_presence=mid_presence,
        onset_strength=onset_strength,
        spectral_contrast=spectral_contrast,
        zcr_norm=zcr_norm,
        centroid_norm=centroid_norm,
    )


# ---------------------------------------------------------------------------
# Helpers — feature per display
# ---------------------------------------------------------------------------

def compute_spectral_contrast_librosa(y: np.ndarray, sr: int) -> float:
    """Contrasto spettrale medio normalizzato [0, 1]."""
    try:
        import librosa
        contrast = librosa.feature.spectral_contrast(y=y, sr=sr, n_bands=6)
        return float(np.clip(np.mean(contrast) / 40.0, 0.0, 1.0))
    except Exception:
        return 0.0


def normalize_onset_strength_essentia(energy_arr: np.ndarray) -> float:
    if len(energy_arr) < 2:
        return 0.0
    max_e = float(np.max(energy_arr))
    if max_e == 0:
        return 0.0
    energy_norm = energy_arr / max_e
    diffs = np.abs(np.diff(energy_norm))
    return float(np.clip(float(np.mean(diffs)) / 0.08, 0.0, 1.0))


def normalize_onset_strength_librosa(onset_env: np.ndarray) -> float:
    if len(onset_env) == 0:
        return 0.0
    p95 = float(np.percentile(onset_env, 95))
    if p95 == 0:
        return 0.0
    return float(np.clip(float(np.mean(onset_env)) / p95, 0.0, 1.0))


def _diag_kwargs(tag: str, kw: Dict[str, Any]) -> None:
    """Log compatto dei valori grezzi per calibrazione (no test → servono dati)."""
    shape = np.array(kw["mfcc_mean"][1:13], dtype=np.float64)
    sn = float(np.linalg.norm(shape))
    shape3 = (shape / sn)[:3].tolist() if sn > 0 else [0, 0, 0]
    logger.info(
        f"[{tag}] mfccμ_dir3={[round(x,2) for x in shape3]} "
        f"std0={kw['mfcc_std'][0]:.1f} d0={kw['delta_mfcc'][0]:.1f} "
        f"onset_r={kw['onset_rate']:.2f} crest={kw['crest_factor']:.2f} "
        f"flux={kw['flux_mean']:.4f} "
        f"bands={[round(v,3) for v in kw['band_energies']]} "
        f"sub={kw['sub_ratio']:.3f} mid={kw['mid_presence']:.3f}"
    )


# ---------------------------------------------------------------------------
# Analisi con Essentia
# ---------------------------------------------------------------------------

def analyze_with_essentia(audio_mono: np.ndarray, audio_stereo: np.ndarray,
                           sample_rate: int, is_preview: bool):
    import essentia.standard as es

    duration = len(audio_mono) / sample_rate
    frame_size = 2048
    hop_size   = 512

    if not is_preview:
        bpm = float(es.RhythmExtractor2013()(audio_mono)[0])
        key, scale, _ = es.KeyExtractor()(audio_mono)
    else:
        bpm, key, scale = None, None, None

    _, _, lufs, _ = es.LoudnessEBUR128()(audio_stereo)
    lufs = float(lufs)

    freq_res = sample_rate / frame_size
    n_bins   = frame_size // 2 + 1
    def _hz_bin(hz: float) -> int:
        return max(0, min(int(hz / freq_res), n_bins - 1))

    band_limits = [
        (_hz_bin(40),    _hz_bin(80)),    # sub-kick
        (_hz_bin(80),    _hz_bin(250)),   # kick body
        (_hz_bin(250),   _hz_bin(2000)),  # snare zone
        (_hz_bin(2000),  _hz_bin(8000)),  # high-mid
        (_hz_bin(8000),  _hz_bin(16000)), # hi-hat
        (_hz_bin(16000), n_bins),         # aria
    ]

    spectrum_algo = es.Spectrum(size=frame_size)
    centroid_algo = es.Centroid(range=float(sample_rate / 2))
    rolloff_algo  = es.RollOff()
    mfcc_algo     = es.MFCC(numberCoefficients=13)
    window_algo   = es.Windowing(type='hann')
    energy_algo   = es.Energy()
    zcr_algo      = es.ZeroCrossingRate()

    def _extract_frame_features(audio_segment: np.ndarray):
        energies, centroids, rolloffs, zcrs = [], [], [], []
        mfcc_frames, band_frames, flux_frames = [], [], []
        prev_spec = None
        for frame in es.FrameGenerator(audio_segment, frameSize=frame_size, hopSize=hop_size):
            windowed = window_algo(frame)
            spec     = spectrum_algo(windowed)
            spec_sq  = spec ** 2
            total_pwr = float(np.sum(spec_sq)) + 1e-10

            energies.append(float(energy_algo(frame)))
            centroids.append(float(centroid_algo(spec)))
            rolloffs.append(float(rolloff_algo(spec)))
            zcrs.append(float(zcr_algo(frame)))

            _, mfcc_coeffs = mfcc_algo(spec)
            mfcc_frames.append(np.array(mfcc_coeffs, dtype=np.float32))

            band_frames.append([float(np.sum(spec_sq[lo:hi])) / total_pwr
                                for lo, hi in band_limits])

            spec_arr = np.array(spec, dtype=np.float32)
            if prev_spec is not None:
                flux_frames.append(float(np.mean(np.abs(spec_arr - prev_spec))))
            prev_spec = spec_arr

        return energies, centroids, rolloffs, zcrs, mfcc_frames, band_frames, flux_frames

    # Estrazione frame su TUTTO l'audio (una sola volta)
    e, c, r, z, m, be, fl = _extract_frame_features(audio_mono)
    energies_a  = np.array(e,  dtype=np.float32)
    centroids_a = np.array(c,  dtype=np.float32)
    rolloffs_a  = np.array(r,  dtype=np.float32)
    zcrs_a      = np.array(z,  dtype=np.float32)
    mfcc_a      = np.array(m,  dtype=np.float32)
    band_a      = np.array(be, dtype=np.float32)
    flux_a      = np.array(fl, dtype=np.float32)
    n_fr        = len(e)

    # Spectral contrast (una volta, stabile per l'analisi)
    spectral_contrast_display = compute_spectral_contrast_librosa(
        audio_mono.astype(np.float32), sample_rate)

    # kwargs sull'intero audio → feature di display + embedding "globale"
    whole_kwargs = segment_kwargs(
        energies_a, mfcc_a, band_a, flux_a, zcrs_a, centroids_a,
        sample_rate, duration, spectral_contrast_display,
    )

    # Feature di display
    energy             = float(np.mean(energies_a)) if n_fr > 0 else 0.0
    spectral_centroid  = float(np.mean(centroids_a)) if n_fr > 0 else 0.0
    spectral_rolloff   = float(np.mean(rolloffs_a))  if n_fr > 0 else 0.0
    zero_crossing_rate = whole_kwargs["zcr_norm"]
    onset_strength     = whole_kwargs["onset_strength"]
    mfcc_mean          = whole_kwargs["mfcc_mean"]
    sub_ratio_display    = whole_kwargs["sub_ratio"]
    mid_presence_display = whole_kwargs["mid_presence"]

    if is_preview:
        # CATALOGO: un embedding sull'intero preview (~30s) — STESSA funzione
        # di una finestra utente da 30s → spazio comparabile.
        embedding = build_embedding(**whole_kwargs)
        _diag_kwargs("embed_preview", whole_kwargs)
        tempo_stability = 0.5
        sliding_embeddings_out = None
    else:
        # UTENTE full-track: embedding globale (fallback) + sliding windows.
        embedding = build_embedding(**whole_kwargs)
        _diag_kwargs("embed_full", whole_kwargs)

        # Tempo stability
        tempo_stability = 0.5
        if bpm and bpm > 0:
            beats = es.RhythmExtractor2013()(audio_mono)[1]
            if len(beats) > 2:
                intervals = np.diff(beats)
                expected  = 60.0 / bpm
                tempo_stability = 1.0 - min(float(np.std(intervals) / expected), 1.0)

        # Sliding windows 30s / stride 5s — STESSA segment_kwargs del preview
        fr_win  = int(30.0 * sample_rate / hop_size)
        fr_step = max(1, int(5.0 * sample_rate / hop_size))
        sliding_embeddings_out = []
        f0 = 0
        while f0 + fr_win <= n_fr:
            f1 = f0 + fr_win
            win_flux = flux_a[f0:max(f0, f1 - 1)]
            win_kwargs = segment_kwargs(
                energies_a[f0:f1], mfcc_a[f0:f1], band_a[f0:f1],
                win_flux, zcrs_a[f0:f1], centroids_a[f0:f1],
                sample_rate, 30.0, spectral_contrast_display,
            )
            sliding_embeddings_out.append(build_embedding(**win_kwargs))
            if f0 == 0:
                _diag_kwargs("embed_win0", win_kwargs)
            f0 += fr_step
        logger.info(f"Essentia sliding windows: {len(sliding_embeddings_out)}")

    return dict(
        bpm=bpm, key=key, scale=scale,
        energy=energy, lufs=lufs, duration=duration,
        spectral_centroid=spectral_centroid,
        spectral_rolloff=spectral_rolloff,
        zero_crossing_rate=zero_crossing_rate,
        onset_strength=onset_strength,
        sub_ratio=sub_ratio_display,
        mid_presence=mid_presence_display,
        tempo_stability=tempo_stability,
        spectral_contrast=spectral_contrast_display,
        mfcc_mean=mfcc_mean,
        sample_rate=sample_rate,
        embedding_prebuilt=embedding,
        sliding_embeddings=sliding_embeddings_out,
    )


# ---------------------------------------------------------------------------
# Analisi con Librosa (fallback se Essentia non disponibile)
# ---------------------------------------------------------------------------

def analyze_with_librosa(audio: np.ndarray, sr: int, is_preview: bool):
    """Fallback librosa — stesso embedding v6. Meno preciso ma non-crash."""
    import librosa

    duration = librosa.get_duration(y=audio, sr=sr)
    logger.info(f"Librosa — {len(audio)} samples @ {sr}Hz")

    if not is_preview:
        tempo, _ = librosa.beat.beat_track(y=audio, sr=sr)
        bpm = float(tempo)
        chroma = librosa.feature.chroma_cqt(y=audio, sr=sr)
        chroma_mean = np.mean(chroma, axis=1)
        key_names = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
        key_idx = int(np.argmax(chroma_mean))
        key   = key_names[key_idx]
        scale = 'minor' if chroma_mean[(key_idx + 3) % 12] > chroma_mean[key_idx] * 0.7 else 'major'
    else:
        bpm, key, scale = None, None, None

    hop_length = 512

    def _seg_kwargs(y_seg: np.ndarray, dur_sec: float) -> Dict[str, Any]:
        mfccs = librosa.feature.mfcc(y=y_seg, sr=sr, n_mfcc=13, hop_length=hop_length)
        mfcc_mean = [float(np.mean(mfccs[i])) for i in range(13)]
        mfcc_std  = [float(np.std(mfccs[i]))  for i in range(13)]
        dm = np.abs(np.diff(mfccs, axis=1))
        delta_mfcc = [float(np.mean(dm[i])) if dm.shape[1] > 0 else 0.0 for i in range(13)]

        stft_mag  = np.abs(librosa.stft(y_seg, n_fft=2048, hop_length=hop_length))
        freqs     = librosa.fft_frequencies(sr=sr, n_fft=2048)
        stft_sq   = stft_mag ** 2
        total_pwr = np.sum(stft_sq, axis=0) + 1e-10

        def _band(lo, hi):
            mask = (freqs >= lo) & (freqs < hi)
            return float(np.mean(np.sum(stft_sq[mask, :], axis=0) / total_pwr))

        band_energies = [_band(40, 80), _band(80, 250), _band(250, 2000),
                         _band(2000, 8000), _band(8000, 16000), _band(16000, sr / 2)]

        spec_diff = np.abs(np.diff(stft_mag, axis=1))
        flux_pf = np.mean(spec_diff, axis=0)
        flux_mean = float(np.mean(flux_pf)) if len(flux_pf) > 0 else 0.0
        flux_std  = float(np.std(flux_pf))  if len(flux_pf) > 0 else 0.0

        rms = librosa.feature.rms(y=y_seg, hop_length=hop_length)[0]
        crest = max(1.0, float(np.max(rms)) / (float(np.mean(rms)) + 1e-10))

        onset_env = librosa.onset.onset_strength(y=y_seg, sr=sr, hop_length=hop_length)
        onsets    = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr, hop_length=hop_length)
        onset_rate = len(onsets) / dur_sec if dur_sec > 0 else 0.0
        onset_std  = float(np.std(onset_env / (np.max(onset_env) + 1e-10))) if len(onset_env) > 0 else 0.0
        onset_strength = normalize_onset_strength_librosa(onset_env)

        zcr = float(np.mean(librosa.feature.zero_crossing_rate(y_seg, hop_length=hop_length)[0]))
        sc  = librosa.feature.spectral_centroid(y=y_seg, sr=sr, hop_length=hop_length)[0]
        centroid_norm = float(np.clip(np.mean(sc) / (sr / 2), 0.0, 1.0))

        return dict(
            mfcc_mean=mfcc_mean, mfcc_std=mfcc_std, delta_mfcc=delta_mfcc,
            band_energies=band_energies,
            onset_rate=onset_rate, onset_std=onset_std, crest_factor=crest,
            flux_mean=flux_mean, flux_std=flux_std,
            sub_ratio=float(band_energies[0] + band_energies[1] * 0.3),
            mid_presence=float(band_energies[2] + band_energies[3] * 0.2),
            onset_strength=onset_strength,
            spectral_contrast=compute_spectral_contrast_librosa(y_seg, sr),
            zcr_norm=zcr, centroid_norm=centroid_norm,
            _energy=float(np.mean(rms)),
            _lufs=-14.0 - float(np.mean(rms)) * 10.0,
        )

    kw = _seg_kwargs(audio, duration)
    emb_keys = ['mfcc_mean','mfcc_std','delta_mfcc','band_energies','onset_rate','onset_std',
                'crest_factor','flux_mean','flux_std','sub_ratio','mid_presence',
                'onset_strength','spectral_contrast','zcr_norm','centroid_norm']
    embedding = build_embedding(**{k: kw[k] for k in emb_keys})

    return dict(
        bpm=bpm, key=key, scale=scale,
        energy=kw['_energy'], lufs=kw['_lufs'], duration=duration,
        spectral_centroid=kw['centroid_norm'] * (sr / 2),
        spectral_rolloff=kw['centroid_norm'] * (sr / 2),
        zero_crossing_rate=kw['zcr_norm'],
        onset_strength=kw['onset_strength'],
        sub_ratio=kw['sub_ratio'],
        mid_presence=kw['mid_presence'],
        tempo_stability=0.5,
        spectral_contrast=kw['spectral_contrast'],
        mfcc_mean=kw['mfcc_mean'],
        sample_rate=sr,
        embedding_prebuilt=embedding,
        sliding_embeddings=None,
    )


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "6.0.0"}


@app.post("/analyze", response_model=AnalysisResponse)
async def analyze_track(request: AnalysisRequest):
    tmp_path = None
    try:
        logger.info(
            f"Analyzing: {request.track_id} | "
            f"preview={request.is_preview} | status={request.track_status}"
        )

        async with httpx.AsyncClient() as client:
            response = await client.get(request.file_url, timeout=60.0)
            response.raise_for_status()
            with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp:
                tmp.write(response.content)
                tmp_path = tmp.name
            logger.info(f"Downloaded {len(response.content)} bytes → {tmp_path}")

        try:
            import essentia.standard as es
            logger.info("Using Essentia (v6 embedding)")
            loader = es.AudioLoader(filename=tmp_path)
            audio_stereo, sample_rate, _, _, _, _ = loader()
            audio_mono = np.mean(audio_stereo, axis=1)
            feat = analyze_with_essentia(audio_mono, audio_stereo, sample_rate, request.is_preview)
        except ImportError:
            logger.warning("Essentia not available, falling back to Librosa")
            import librosa
            audio_mono, sample_rate = librosa.load(tmp_path, sr=None, mono=True)
            feat = analyze_with_librosa(audio_mono, sample_rate, request.is_preview)

        sr              = feat.pop("sample_rate")
        embedding       = feat.pop("embedding_prebuilt")
        sliding_windows = feat.pop("sliding_embeddings", None)

        embeddings_list: Optional[List[List[float]]] = None
        if not request.is_preview:
            if sliding_windows is not None and len(sliding_windows) > 0:
                embeddings_list = sliding_windows
                logger.info(f"Using {len(embeddings_list)} Essentia sliding-window embeddings")
            else:
                logger.warning("No sliding windows available (Librosa fallback)")

        analysis_type = "preview" if request.is_preview else "full"
        logger.info(
            f"Done — type={analysis_type} BPM={feat['bpm']} "
            f"sub={feat['sub_ratio']:.3f} mid={feat['mid_presence']:.3f} "
            f"onset={feat['onset_strength']:.3f}"
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
        status_code = e.response.status_code
        logger.error(f"CDN error {status_code} — preview URL expired or unavailable")
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
