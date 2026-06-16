import numpy as np

# Modello REALISTICO:
# - Le tracce techno variano lungo POCHI assi stilistici -> deviazioni in un
#   sottospazio di rango K (non 64 indipendenti). Piu' K e' piccolo, piu' le
#   tracce si affollano e collidono al crescere di N.
# - alpha: quanto la deviazione pesa sul "comune" (controlla quanto i cosine
#   grezzi sono schiacciati verso 1).
# - beta: rumore di misura sulla traccia VERA (stessa traccia ri-analizzata da
#   una finestra/encoding diversi). Le feature a mano sono MENO stabili -> beta alto.
def sim(N, alpha, K, beta, dim=64, trials=500, centered=True, seed=1):
    rng = np.random.default_rng(seed)
    ok = 0
    for _ in range(trials):
        m = np.abs(rng.normal(1.0, 0.3, dim))               # baseline comune (techno)
        B = rng.normal(0, 1, (dim, K)); B /= np.linalg.norm(B, axis=0, keepdims=True)
        C = rng.normal(0, 1, (N, K))                        # coordinate stilistiche
        scale = alpha * np.linalg.norm(m) / np.sqrt(K)
        E = m[None, :] + scale * (C @ B.T)                  # impronte catalogo
        ti = rng.integers(N)
        c_noise = rng.normal(0, 1, K)                       # rumore nel sottospazio
        o_noise = rng.normal(0, 1, dim)                     # rumore fuori sottospazio
        q = m + scale * (C[ti] @ B.T) + beta * scale * (c_noise @ B.T + 0.3*o_noise)
        if centered:
            mu = E.mean(axis=0); A = E - mu; b = q - mu
        else:
            A, b = E, q
        sims = A @ b / (np.linalg.norm(A, axis=1) * np.linalg.norm(b) + 1e-9)
        ok += (np.argmax(sims) == ti)
    return ok / trials

def raw_cos(alpha, K, dim=64, seed=0):
    rng = np.random.default_rng(seed)
    m = np.abs(rng.normal(1.0,0.3,dim)); B=rng.normal(0,1,(dim,K)); B/=np.linalg.norm(B,axis=0,keepdims=True)
    C=rng.normal(0,1,(300,K)); E=m[None,:]+alpha*np.linalg.norm(m)/np.sqrt(K)*(C@B.T)
    En=E/np.linalg.norm(E,axis=1,keepdims=True); S=En@En.T; iu=np.triu_indices(300,1)
    return S[iu].mean()

approaches = [
    # nome,                              alpha, K,  beta, centered
    ("Feature a mano (raw cosine)",      0.20,  4,  0.80, False),
    ("Feature a mano + CENTERING",       0.20,  4,  0.80, True),
    ("Embedding NEURALE + centering",    0.20,  30, 0.35, True),
]
Ns = [30, 100, 300, 1000, 3000]
print("\nPRECISION@1 — la traccia GIUSTA esce #1 (media su 500 prove)\n")
print(f"{'approccio':34s} " + " ".join(f"N={n:>4d}" for n in Ns))
print("-"*78)
for name, alpha, K, beta, cen in approaches:
    row = [sim(N, alpha, K, beta, centered=cen) for N in Ns]
    print(f"{name:34s} " + " ".join(f"{r*100:5.0f}%" for r in row))

print("\nControllo realismo — cosine grezzo medio fra tracce diverse (osservato ~0.97-0.99):")
print(f"  feature a mano (K=4):   {raw_cos(0.20,4):+.3f}")
print(f"  neurale  (K=30):        {raw_cos(0.20,30):+.3f}")
