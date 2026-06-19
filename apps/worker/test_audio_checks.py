"""Test dei check tecnici (solo numpy). Esegui: python3 test_audio_checks.py"""
import numpy as np
from audio_checks import true_peak_dbtp, crest_db, stereo_correlation, structure_metrics, compute_checks

SR = 44100
t = np.linspace(0, 2, SR * 2, endpoint=False)


def approx(a, b, tol):
    assert abs(a - b) <= tol, f"{a} != {b} (tol {tol})"


def test_true_peak():
    full = np.sin(2 * np.pi * 1000 * t)                 # ampiezza 1.0
    half = 0.5 * np.sin(2 * np.pi * 1000 * t)           # ampiezza 0.5 → ~-6 dBTP
    assert true_peak_dbtp(full) >= -0.5                 # vicino a 0 (o sopra per inter-sample)
    approx(true_peak_dbtp(half), -6.0, 1.0)
    assert true_peak_dbtp(np.zeros(100)) < -100         # silenzio
    print("  ok true_peak")


def test_crest():
    sine = np.sin(2 * np.pi * 1000 * t)
    approx(crest_db(sine), 3.01, 0.5)                   # sinusoide: peak/rms = sqrt(2) ≈ 3 dB
    rng = np.random.default_rng(0)
    assert crest_db(rng.standard_normal(SR)) > crest_db(sine)  # rumore più dinamico
    assert crest_db(np.zeros(10)) == 0.0
    print("  ok crest")


def test_stereo_corr():
    mono = np.sin(2 * np.pi * 500 * t)
    same = np.stack([mono, mono], axis=1)
    anti = np.stack([mono, -mono], axis=1)
    rng = np.random.default_rng(1)
    indep = np.stack([rng.standard_normal(SR), rng.standard_normal(SR)], axis=1)
    approx(stereo_correlation(same), 1.0, 1e-6)
    approx(stereo_correlation(anti), -1.0, 1e-6)         # anti-fase → cancella in mono
    assert abs(stereo_correlation(indep)) < 0.1
    assert stereo_correlation(mono) == 1.0               # input mono → 1
    print("  ok stereo_correlation")


def test_structure():
    t8 = np.linspace(0, 8, SR * 8, endpoint=False)       # 8s → 8 frame da 1s
    flat = np.sin(2 * np.pi * 200 * t8)                  # energia piatta → loop
    sm_flat = structure_metrics(flat, SR)
    assert sm_flat["loopiness"] > 0.8, sm_flat
    # segnale che CRESCE in ampiezza → intro_build positivo, meno loop
    ramp = (np.linspace(0.05, 1.0, t8.shape[0]) * np.sin(2 * np.pi * 200 * t8))
    sm_ramp = structure_metrics(ramp, SR)
    assert sm_ramp["intro_build"] > 0.0, sm_ramp
    assert sm_ramp["loopiness"] < sm_flat["loopiness"]
    print("  ok structure")


def test_compute_checks():
    stereo = np.stack([np.sin(2 * np.pi * 300 * t), np.sin(2 * np.pi * 300 * t)], axis=1)
    c = compute_checks(stereo, stereo.mean(axis=1), SR)
    for key in ("true_peak_dbtp", "crest_db", "stereo_correlation", "loopiness", "intro_build", "energy_curve"):
        assert key in c, key
    assert isinstance(c["energy_curve"], list)
    print("  ok compute_checks")


if __name__ == "__main__":
    test_true_peak(); test_crest(); test_stereo_corr(); test_structure(); test_compute_checks()
    print("TUTTI I TEST AUDIO OK")
