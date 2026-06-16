# Upgrade path: learned audio embedding (Discogs-EffNet)

**Status:** documented, NOT enabled. Do this only when you can run a real test
(you must re-analyze the whole catalog after enabling). It is the single
highest-ceiling improvement to matching quality — but it changes the embedding
space, so it's all-or-nothing.

---

## Why

The current v6 embedding uses **hand-crafted** features (MFCC stats, band
energies, percussion). These are good but fundamentally limited: two different
techno tracks can have very similar global statistics. To truly discriminate
*within* the same genre you want a **learned** embedding — a neural net trained
on millions of tracks that has internalized what makes records sound different.

Essentia ships exactly the right model: **Discogs-EffNet**, trained on the
Discogs database, which has an extremely rich *electronic* taxonomy
(tech house, techno, minimal, deep house, …). Its penultimate-layer embedding
clusters tracks by real stylistic identity far better than any MFCC statistic.

The worker already loads TensorFlow (see startup logs), so the runtime supports
it. You only need the model files.

## What changes conceptually

- Each ~30s segment → EffNet → `(n_patches, 1280)` → mean-pool → **1280-dim** vector.
- We deterministically **random-project** 1280 → 64 (seeded Gaussian matrix).
  Random projection approximately preserves cosine similarity
  (Johnson–Lindenstrauss) and needs no training/fitting, so catalog and user
  tracks land in the same space with **no DB migration** (`audio_embedding`
  stays `VECTOR(64)`).
- Everything downstream (sliding windows, max-cosine, scoring) is unchanged.

> Higher-fidelity option: change the DB column to `VECTOR(256)` and project to
> 256 instead of 64. Better ranking, but requires a migration. Start with 64.

---

## Step 1 — get the model files into the Space

Add to the HF Space (e.g. a `Dockerfile` line or a startup download). Files:

- `discogs-effnet-bs64-1.pb`  (weights, ~80 MB)
- `discogs-effnet-bs64-1.json` (metadata)

Download URLs are listed on https://essentia.upf.edu/models.html (Discogs-EffNet).
Place them next to `app.py` (or set `EFFNET_MODEL_PATH`).

## Step 2 — add the embedding code (drop-in)

```python
import os, numpy as np

USE_DEEP_EMBEDDING = os.getenv("USE_DEEP_EMBEDDING", "false").lower() == "true"
EFFNET_MODEL_PATH  = os.getenv("EFFNET_MODEL_PATH", "discogs-effnet-bs64-1.pb")
_DEEP_OUT_DIM      = 64           # must match VECTOR(N) in the DB
_RP_SEED           = 20260530     # FIXED — never change once catalog is analyzed

# Deterministic random projection matrix 1280 -> 64 (built once).
_rng = np.random.default_rng(_RP_SEED)
_RP_MATRIX = _rng.standard_normal((1280, _DEEP_OUT_DIM)).astype(np.float32)
_RP_MATRIX /= np.linalg.norm(_RP_MATRIX, axis=0, keepdims=True)  # unit columns

_effnet_model = None  # lazy singleton

def _get_effnet():
    global _effnet_model
    if _effnet_model is None:
        from essentia.standard import TensorflowPredictEffnetDiscogs
        _effnet_model = TensorflowPredictEffnetDiscogs(
            graphFilename=EFFNET_MODEL_PATH, output="PartitionedCall:1"
        )
    return _effnet_model

def deep_embedding(audio_16k_mono: np.ndarray) -> list:
    """audio MUST be mono @ 16 kHz. Returns a 64-dim L2-normalized vector."""
    emb = _get_effnet()(audio_16k_mono)          # (n_patches, 1280)
    pooled = np.mean(np.asarray(emb), axis=0)     # (1280,)
    proj = pooled @ _RP_MATRIX                     # (64,)
    n = np.linalg.norm(proj)
    if n > 0:
        proj = proj / n
    return proj.astype(np.float32).tolist()
```

## Step 3 — wire it into `analyze_with_essentia`

EffNet needs **16 kHz mono**. Resample once:

```python
import essentia.standard as es
audio_16k = es.Resample(inputSampleRate=sample_rate, outputSampleRate=16000)(audio_mono)
hop16 = 16000  # samples per second at 16k
```

- **Preview (catalog):** `embedding = deep_embedding(audio_16k)` over the whole
  ~30s preview.
- **Full track (user):** for each 30s window
  `audio_16k[i*5*16000 : i*5*16000 + 30*16000]`, call `deep_embedding(...)`,
  collect into `sliding_embeddings_out`. (Same 30s/5s stride as now, just on the
  16k signal.) Keep a whole-track `deep_embedding` as the fallback `embedding`.

Guard the whole thing:

```python
if USE_DEEP_EMBEDDING:
    try:
        embedding = deep_embedding(...)        # and the sliding windows
    except Exception as e:
        logger.error(f"deep embedding failed, falling back to v6 handcrafted: {e}")
        embedding = build_embedding(**whole_kwargs)
        # ... handcrafted sliding windows
else:
    embedding = build_embedding(**whole_kwargs)
```

The `try/except` means if the model is missing or the API differs, the worker
**degrades to v6 hand-crafted** instead of crashing.

## Step 4 — enable + re-analyze

1. Set Space env `USE_DEEP_EMBEDDING=true`, restart.
2. Confirm `/health` and a test analysis log shows the deep path (add a log line).
3. **Re-analyze the ENTIRE catalog** — old v6 vectors are a different space and
   must not be mixed with deep vectors.
4. Test a known track. Expect the exact track to top its label and much wider
   cosine spread between labels.

## Rollback

Set `USE_DEEP_EMBEDDING=false`, restart, re-analyze catalog. Back to v6.

---

## Notes / gotchas

- **All-or-nothing:** never mix deep and hand-crafted vectors in `audio_embedding`.
  Whenever you flip the flag, re-analyze everything.
- **`_RP_SEED` is frozen.** If you ever change it, every stored vector becomes
  incompatible — re-analyze. Treat it like a schema version.
- **Cost:** EffNet is heavier than the MFCC pipeline. A 6-min user track = ~67
  windows × a forward pass. On HF free CPU this may take 30–90s. If too slow,
  reduce stride (e.g. 10s instead of 5s) or run EffNet once on the whole track
  for the user too and rely on the whole-track vector (loses drop-vs-drop
  precision but much faster).
- **Better fidelity:** if 64-dim projection underperforms, migrate
  `audio_embedding` to `VECTOR(256)`, set `_DEEP_OUT_DIM=256`, re-analyze.
- The `discogs-effnet` embeddings can ALSO drive genre/subgenre auto-tagging
  (there are companion classifier heads), which feeds the "auto-genre" and
  "smart submission targeting" features in STRATEGY.md.
