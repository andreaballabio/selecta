"""
Check tecnici "da A&R" — quelli che fanno scartare una demo in 2 secondi.
Solo numpy (niente essentia/librosa) → veloci e TESTABILI in isolamento.

Funzioni pure su array audio. app.py le chiama in coda all'analisi; il report
web le traduce in verdetti azionabili (true peak, mono, punch, struttura).
"""
import numpy as np


def true_peak_dbtp(stereo, oversample: int = 4) -> float:
    """True peak in dBTP, stimato con oversampling (interpolazione) per canale.
    >0 dBTP = clipping inter-sample (motivo classico di scarto)."""
    a = np.asarray(stereo, dtype=np.float64)
    if a.ndim == 1:
        a = a[:, None]
    peak = 0.0
    idx = np.arange(a.shape[0])
    if a.shape[0] >= 2:
        xi = np.linspace(0, a.shape[0] - 1, a.shape[0] * oversample)
    for ch in range(a.shape[1]):
        x = a[:, ch]
        if x.shape[0] < 2:
            p = float(np.max(np.abs(x))) if x.size else 0.0
        else:
            p = float(np.max(np.abs(np.interp(xi, idx, x))))
        peak = max(peak, p)
    if peak <= 0:
        return -120.0
    return float(20.0 * np.log10(peak))


def crest_db(mono) -> float:
    """Crest factor (peak/RMS) in dB. Basso (<~6) = master molto compresso;
    alto = molto dinamico. Proxy del 'punch'."""
    x = np.asarray(mono, dtype=np.float64)
    if x.size == 0:
        return 0.0
    peak = float(np.max(np.abs(x)))
    rms = float(np.sqrt(np.mean(x ** 2))) + 1e-12
    if peak <= 0:
        return 0.0
    return float(20.0 * np.log10(peak / rms))


def stereo_correlation(stereo) -> float:
    """Correlazione L/R in [-1,1]. ~1 = quasi mono (sicuro in mono); valori
    bassi/negativi = rischio cancellazioni in mono (impianti club)."""
    a = np.asarray(stereo, dtype=np.float64)
    if a.ndim != 2 or a.shape[1] < 2:
        return 1.0  # mono → perfettamente compatibile
    l, r = a[:, 0], a[:, 1]
    if np.std(l) < 1e-9 or np.std(r) < 1e-9:
        return 1.0
    return float(np.clip(np.corrcoef(l, r)[0, 1], -1.0, 1.0))


def energy_curve(mono, sr: int, frame_sec: float = 1.0):
    """Curva RMS a frame da ~1s."""
    x = np.asarray(mono, dtype=np.float64)
    fr = max(1, int(sr * frame_sec))
    n = x.shape[0] // fr
    if n < 1:
        return np.array([float(np.sqrt(np.mean(x ** 2)))]) if x.size else np.array([0.0])
    return np.array([float(np.sqrt(np.mean(x[i * fr:(i + 1) * fr] ** 2))) for i in range(n)])


def structure_metrics(mono, sr: int) -> dict:
    """loopiness (0..1, alto = energia piatta = 'loop che non va da nessuna parte')
    e intro_build (sale l'energia nei primi ~30s?). Più una curva ridotta per il display."""
    ec = energy_curve(mono, sr, 1.0)
    m = float(np.mean(ec)) + 1e-12
    if ec.size < 4:
        return dict(loopiness=0.5, intro_build=0.0, energy_curve=[round(float(v), 4) for v in ec])
    cv = float(np.std(ec) / m)                       # coeff. variazione: basso = piatto
    loopiness = float(np.clip(1.0 - cv / 0.5, 0.0, 1.0))
    intro = ec[:min(30, ec.size)]
    half = max(1, intro.shape[0] // 2)
    intro_build = float((np.mean(intro[half:]) - np.mean(intro[:half])) / m)
    k = max(1, ec.size // 40)
    curve = [round(float(v), 4) for v in ec[::k][:40]]
    return dict(loopiness=round(loopiness, 4), intro_build=round(intro_build, 4), energy_curve=curve)


def compute_checks(audio_stereo, audio_mono, sr: int) -> dict:
    """Tutti i check tecnici in un colpo solo (scalari + curva energia)."""
    out = dict(
        true_peak_dbtp=round(true_peak_dbtp(audio_stereo), 2),
        crest_db=round(crest_db(audio_mono), 2),
        stereo_correlation=round(stereo_correlation(audio_stereo), 3),
    )
    out.update(structure_metrics(audio_mono, sr))
    return out
