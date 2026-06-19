// Label Intelligence — derivata 100% dai dati, pensata per scalare a centinaia
// di label. Tutto si calcola sui CENTROIDI (un vettore per label, già salvato in
// label_profiles.avg_embedding) → costo O(label²): istantaneo anche con 500 label.
//
// Produce, per ogni label e in automatico:
//  - genericWeight  : quanto è "generica/centrale" (da smorzare nel match, stile IDF)
//  - distinctiveness: quanto il suo suono è distinto dai vicini (→ affidabilità)
//  - nearest        : la label più simile (info "molto simile a X", MAI fusione)
//  - famiglie       : cluster di label dallo stesso suono (solo raggruppamento)
//
// File SELF-CONTAINED (nessun import) → testabile con `node --test`.

export function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i] ?? 0; dot += x * y; na += x * x; nb += y * y }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export interface LabelVec { id: string; name: string; centroid: number[]; tracks: number }

export interface LabelMetric {
  id: string
  name: string
  tracks: number
  centrality: number       // 0..1 ~ media similarità agli altri (alto = generico)
  distinctiveness: number  // 0..1 (1 = molto distinto: nessun "gemello" vicino)
  genericWeight: number    // moltiplicatore [floor..1] per il match (basso = generico)
  nearestId: string | null
  nearestName: string | null
  nearestSim: number       // similarità al vicino più simile
  reliable: boolean        // false = suono sfocato → match meno affidabile
}

export interface IntelOptions {
  weightFloor?: number          // peso minimo per la label più generica (default 0.6)
  reliabilityMinDistinct?: number // sotto questa distinctiveness → non affidabile (default 0.25)
}

/** Mean-centering: toglie il "centroide medio" → il coseno diventa più discriminante. */
function center(vectors: number[][]): number[][] {
  const n = vectors.length
  if (!n) return []
  const dim = vectors[0].length
  const mean = new Array(dim).fill(0)
  for (const v of vectors) for (let i = 0; i < dim; i++) mean[i] += v[i] ?? 0
  for (let i = 0; i < dim; i++) mean[i] /= n
  return vectors.map((v) => v.map((x, i) => x - mean[i]))
}

export function labelMetrics(labels: LabelVec[], opts: IntelOptions = {}): LabelMetric[] {
  const floor = opts.weightFloor ?? 0.6
  const minDistinct = opts.reliabilityMinDistinct ?? 0.25
  const valid = labels.filter((l) => l.centroid.length > 0)
  if (valid.length < 2) {
    return valid.map((l) => ({
      id: l.id, name: l.name, tracks: l.tracks, centrality: 0, distinctiveness: 1,
      genericWeight: 1, nearestId: null, nearestName: null, nearestSim: 0, reliable: true,
    }))
  }
  const C = center(valid.map((l) => l.centroid))

  // Similarità coppia-a-coppia → centralità (media) e vicino più simile (max).
  const centrality: number[] = new Array(valid.length).fill(0)
  const nearest: { idx: number; sim: number }[] = valid.map(() => ({ idx: -1, sim: -Infinity }))
  for (let i = 0; i < valid.length; i++) {
    let sum = 0
    for (let j = 0; j < valid.length; j++) {
      if (i === j) continue
      const s = cosine(C[i], C[j])
      sum += s
      if (s > nearest[i].sim) nearest[i] = { idx: j, sim: s }
    }
    centrality[i] = sum / (valid.length - 1)
  }

  // genericWeight: min-max della centralità → moltiplicatore [floor..1].
  const lo = Math.min(...centrality), hi = Math.max(...centrality)
  const norm = (c: number) => (hi > lo ? (c - lo) / (hi - lo) : 0)

  return valid.map((l, i) => {
    const distinctiveness = Math.max(0, Math.min(1, 1 - nearest[i].sim))
    return {
      id: l.id, name: l.name, tracks: l.tracks,
      centrality: Math.round(((centrality[i] + 1) / 2) * 1000) / 1000, // riscalato 0..1 per lettura
      distinctiveness: Math.round(distinctiveness * 1000) / 1000,
      genericWeight: Math.round((1 - norm(centrality[i]) * (1 - floor)) * 1000) / 1000,
      nearestId: nearest[i].idx >= 0 ? valid[nearest[i].idx].id : null,
      nearestName: nearest[i].idx >= 0 ? valid[nearest[i].idx].name : null,
      nearestSim: Math.round(nearest[i].sim * 1000) / 1000,
      reliable: distinctiveness >= minDistinct,
    }
  })
}

export interface Family { name: string; members: { id: string; name: string; tracks: number }[] }

/**
 * Famiglie di suono: grafo dove due label sono collegate se i loro centroidi
 * (mean-centered) superano `threshold`; le componenti connesse sono le famiglie.
 * Deterministico, O(label²). Nome famiglia = membro con più tracce.
 */
export function soundFamilies(labels: LabelVec[], threshold = 0.5): Family[] {
  const valid = labels.filter((l) => l.centroid.length > 0)
  if (!valid.length) return []
  const C = center(valid.map((l) => l.centroid))
  // Union-Find
  const parent = valid.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : (parent[x] = find(parent[x])))
  const union = (a: number, b: number) => { parent[find(a)] = find(b) }
  for (let i = 0; i < valid.length; i++)
    for (let j = i + 1; j < valid.length; j++)
      if (cosine(C[i], C[j]) >= threshold) union(i, j)

  const groups = new Map<number, number[]>()
  for (let i = 0; i < valid.length; i++) {
    const r = find(i)
    const arr = groups.get(r) ?? []; arr.push(i); groups.set(r, arr)
  }
  return [...groups.values()].map((idxs) => {
    const members = idxs.map((i) => ({ id: valid[i].id, name: valid[i].name, tracks: valid[i].tracks }))
      .sort((a, b) => b.tracks - a.tracks)
    return { name: members[0].name, members }
  }).sort((a, b) => b.members.length - a.members.length)
}
