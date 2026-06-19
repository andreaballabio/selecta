import { test } from 'node:test'
import assert from 'node:assert/strict'
import { cosine, meanCenter, evaluatePrecision, type EvalTrack } from '../src/lib/eval-matching.ts'

// PRNG deterministico (mulberry32) → test stabili.
function rng(seed: number) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

test('cosine: identici=1, ortogonali=0, opposti=-1', () => {
  assert.ok(Math.abs(cosine([1, 2, 3], [1, 2, 3]) - 1) < 1e-9)
  assert.ok(Math.abs(cosine([1, 0], [0, 1])) < 1e-9)
  assert.ok(Math.abs(cosine([1, 0], [-1, 0]) + 1) < 1e-9)
  assert.equal(cosine([], [1]), 0) // vettore vuoto → 0, niente crash
})

test('meanCenter: la media dei vettori centrati è ~0', () => {
  const { centered, mean } = meanCenter([[1, 2], [3, 4], [5, 6]])
  assert.deepEqual(mean, [3, 4])
  const colSum = centered.reduce((s, v) => [s[0] + v[0], s[1] + v[1]], [0, 0])
  assert.ok(Math.abs(colSum[0]) < 1e-9 && Math.abs(colSum[1]) < 1e-9)
})

// Costruisce N tracce per label, ciascuna = direzione base della label + rumore.
function buildCatalog(nLabels: number, perLabel: number, noise: number, seed = 1): EvalTrack[] {
  const rand = rng(seed)
  const dim = 64
  const out: EvalTrack[] = []
  for (let l = 0; l < nLabels; l++) {
    const base = Array.from({ length: dim }, (_, i) => (i % nLabels === l ? 1 : 0) + (rand() - 0.5) * 0.05)
    for (let t = 0; t < perLabel; t++) {
      const emb = base.map((b) => b + (rand() - 0.5) * noise)
      out.push({ labelId: `L${l}`, embedding: emb })
    }
  }
  return out
}

test('label ben separate → precision@1 alta', () => {
  const catalog = buildCatalog(5, 8, 0.15) // rumore basso
  const r = evaluatePrecision(catalog, { minTracksPerLabel: 3 })
  assert.equal(r.tracksEvaluated, 40)
  assert.equal(r.labelsCovered, 5)
  assert.ok(r.precisionAt1 > 0.9, `precision@1=${r.precisionAt1} dovrebbe essere >0.9`)
  assert.ok(r.precisionAt5 >= r.precisionAt1) // top-5 non può essere peggiore di top-1
  assert.ok(r.mrr > 0.9)
})

test('label sovrapposte/rumore alto → precision@1 bassa', () => {
  // Tutte le label condividono la STESSA direzione + tanto rumore → indistinguibili.
  const rand = rng(7)
  const catalog: EvalTrack[] = []
  for (let l = 0; l < 5; l++)
    for (let t = 0; t < 8; t++)
      catalog.push({ labelId: `L${l}`, embedding: Array.from({ length: 64 }, () => 1 + (rand() - 0.5) * 3) })
  const r = evaluatePrecision(catalog, { minTracksPerLabel: 3 })
  // Con 5 label a caso, beccare la giusta al 1° posto ~20%.
  assert.ok(r.precisionAt1 < 0.5, `precision@1=${r.precisionAt1} dovrebbe essere bassa`)
})

test('label sotto soglia escluse', () => {
  const catalog: EvalTrack[] = [
    { labelId: 'A', embedding: [1, 0, 0] }, { labelId: 'A', embedding: [1, 0, 0] }, { labelId: 'A', embedding: [1, 0, 0] },
    { labelId: 'B', embedding: [0, 1, 0] }, // solo 1 traccia → esclusa con minTracks=3
  ]
  const r = evaluatePrecision(catalog, { minTracksPerLabel: 3 })
  assert.equal(r.labelsCovered, 1)
  assert.equal(r.tracksEvaluated, 3)
})

test('catalogo vuoto → nessun crash', () => {
  const r = evaluatePrecision([], {})
  assert.equal(r.tracksEvaluated, 0)
  assert.equal(r.precisionAt1, 0)
})
