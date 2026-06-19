// Validation harness del matching — misura QUANTO è bravo l'algoritmo su
// ground-truth reale (le label note del catalogo), invece di fidarsi "a sensazione".
//
// Idea (leave-one-out): ogni traccia del catalogo è una "demo di prova". La
// togliamo, la matchiamo contro tutte le label e guardiamo se la SUA vera label
// finisce in cima. Se l'algoritmo è buono, la label giusta è quasi sempre in top-k.
//
// Output = precision@k + MRR → un NUMERO di credibilità pubblicabile
// ("la label giusta è in top-5 nell'X% dei casi").
//
// File SELF-CONTAINED (nessun import) → testabile direttamente con `node --test`.

export function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i] ?? 0; dot += x * y; na += x * x; nb += y * y }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

/** Mean-centering (come in produzione): toglie la "traccia media" del catalogo →
 *  il coseno diventa correlazione di Pearson, molto più discriminante. */
export function meanCenter(vectors: number[][]): { centered: number[][]; mean: number[] } {
  const n = vectors.length
  if (n === 0) return { centered: [], mean: [] }
  const dim = vectors[0].length
  const mean = new Array(dim).fill(0)
  for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] ?? 0
  for (let i = 0; i < dim; i++) mean[i] /= n
  const centered = vectors.map((v) => v.map((x, i) => x - mean[i]))
  return { centered, mean }
}

export interface EvalTrack { labelId: string; embedding: number[] }

export interface PrecisionResult {
  tracksEvaluated: number
  labelsCovered: number
  precisionAt1: number   // % di tracce con la label giusta al 1° posto
  precisionAt3: number
  precisionAt5: number
  mrr: number            // Mean Reciprocal Rank (1=perfetto)
  perLabel: { labelId: string; tracks: number; hitRateTop5: number; avgRank: number }[]
}

export interface EvalOptions {
  minTracksPerLabel?: number  // label con meno tracce escluse (default 3, come in prod)
  topKWindows?: number        // media delle migliori K similarità per label (default 5)
  center?: boolean            // mean-centering (default true, come in prod)
}

/**
 * Valutazione leave-one-out. Per ogni traccia: punteggio di ogni label = media
 * delle migliori K similarità coseno fra la traccia e le tracce di quella label
 * (escludendo sé stessa). Si ordina e si guarda dove cade la label vera.
 */
export function evaluatePrecision(catalog: EvalTrack[], opts: EvalOptions = {}): PrecisionResult {
  const minTracks = opts.minTracksPerLabel ?? 3
  const topK = opts.topKWindows ?? 5
  const doCenter = opts.center ?? true

  // 1) Tieni solo le label con abbastanza tracce.
  const counts = new Map<string, number>()
  for (const t of catalog) counts.set(t.labelId, (counts.get(t.labelId) ?? 0) + 1)
  const eligible = catalog.filter((t) => (counts.get(t.labelId) ?? 0) >= minTracks && t.embedding.length > 0)
  if (eligible.length === 0) {
    return { tracksEvaluated: 0, labelsCovered: 0, precisionAt1: 0, precisionAt3: 0, precisionAt5: 0, mrr: 0, perLabel: [] }
  }

  // 2) Mean-centering opzionale (sullo stesso set, come in prod).
  const embeddings = doCenter ? meanCenter(eligible.map((t) => t.embedding)).centered : eligible.map((t) => t.embedding)

  // 3) Indici delle tracce per label (per escludere sé stessa e iterare veloce).
  const byLabel = new Map<string, number[]>()
  eligible.forEach((t, i) => {
    const arr = byLabel.get(t.labelId) ?? []
    arr.push(i); byLabel.set(t.labelId, arr)
  })
  const labels = [...byLabel.keys()]

  let hit1 = 0, hit3 = 0, hit5 = 0, rrSum = 0
  const perLabelAgg = new Map<string, { tracks: number; hit5: number; rankSum: number }>()

  for (let qi = 0; qi < eligible.length; qi++) {
    const home = eligible[qi].labelId
    const qv = embeddings[qi]

    // Punteggio per ogni label = media top-K similarità (escludendo la query stessa).
    const scored: { labelId: string; score: number }[] = []
    for (const L of labels) {
      const idxs = byLabel.get(L)!
      const sims: number[] = []
      for (const j of idxs) { if (j === qi) continue; sims.push(cosine(qv, embeddings[j])) }
      if (sims.length === 0) continue // label rimasta senza tracce (era solo la query)
      sims.sort((a, b) => b - a)
      const k = Math.min(topK, sims.length)
      let s = 0; for (let m = 0; m < k; m++) s += sims[m]
      scored.push({ labelId: L, score: s / k })
    }
    scored.sort((a, b) => b.score - a.score)

    const rank = scored.findIndex((s) => s.labelId === home) + 1 // 1-based; 0 se assente
    if (rank >= 1) {
      if (rank <= 1) hit1++
      if (rank <= 3) hit3++
      if (rank <= 5) hit5++
      rrSum += 1 / rank
    }
    const agg = perLabelAgg.get(home) ?? { tracks: 0, hit5: 0, rankSum: 0 }
    agg.tracks++
    if (rank >= 1 && rank <= 5) agg.hit5++
    agg.rankSum += rank >= 1 ? rank : labels.length
    perLabelAgg.set(home, agg)
  }

  const n = eligible.length
  const perLabel = [...perLabelAgg.entries()]
    .map(([labelId, a]) => ({ labelId, tracks: a.tracks, hitRateTop5: a.hit5 / a.tracks, avgRank: a.rankSum / a.tracks }))
    .sort((a, b) => b.hitRateTop5 - a.hitRateTop5)

  return {
    tracksEvaluated: n,
    labelsCovered: labels.length,
    precisionAt1: hit1 / n,
    precisionAt3: hit3 / n,
    precisionAt5: hit5 / n,
    mrr: rrSum / n,
    perLabel,
  }
}
