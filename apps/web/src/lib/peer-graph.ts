// Peer-graph per SUONO: "i producer che suonano come te".
// Usa gli embedding delle tracce pubblicate (che già abbiamo). È un grafo sociale
// per timbro che i colossi (cataloghi) non costruiscono, e migliora con gli utenti.
//
// File SELF-CONTAINED → testabile con `node --test`.

function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { const x = a[i], y = b[i] ?? 0; dot += x * y; na += x * x; nb += y * y }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export interface PeerTrack {
  userId: string
  artist: string | null
  trackTitle?: string | null
  embedding: number[]
}

export interface Peer {
  userId: string
  artist: string | null
  score: number          // cosine [−1..1] col tuo brano più vicino
  trackTitle: string | null
}

export interface PeerOptions {
  k?: number                     // quanti peer restituire (default 12)
  excludeUserIds?: Iterable<string> // utenti da escludere (es. te stesso)
  center?: boolean               // mean-centering sul pool (default true)
  minScore?: number              // soglia minima di affinità (default 0)
}

/**
 * Dato il/i tuo/i embedding, trova gli ALTRI producer più vicini.
 * Punteggio di un producer = la sua traccia più vicina a una qualsiasi delle tue.
 */
export function nearestPeers(targetEmbeddings: number[][], candidates: PeerTrack[], opts: PeerOptions = {}): Peer[] {
  const k = opts.k ?? 12
  const center = opts.center ?? true
  const minScore = opts.minScore ?? 0
  const exclude = new Set(opts.excludeUserIds ?? [])

  const targets = targetEmbeddings.filter((e) => e.length > 0)
  const valid = candidates.filter((c) => c.embedding.length > 0 && !exclude.has(c.userId))
  if (targets.length === 0 || valid.length === 0) return []

  // Mean-centering sul pool (target + candidati) → coseno più discriminante.
  let T = targets, C = valid.map((c) => c.embedding)
  if (center) {
    const all = [...targets, ...C]
    const dim = all[0].length
    const mean = new Array(dim).fill(0)
    for (const v of all) for (let i = 0; i < dim; i++) mean[i] += v[i] ?? 0
    for (let i = 0; i < dim; i++) mean[i] /= all.length
    const sub = (v: number[]) => v.map((x, i) => x - mean[i])
    T = targets.map(sub); C = C.map(sub)
  }

  // Miglior traccia per ciascun producer.
  const best = new Map<string, Peer>()
  valid.forEach((c, i) => {
    let s = -Infinity
    for (const t of T) { const v = cosine(t, C[i]); if (v > s) s = v }
    const cur = best.get(c.userId)
    if (!cur || s > cur.score) best.set(c.userId, { userId: c.userId, artist: c.artist, score: s, trackTitle: c.trackTitle ?? null })
  })

  return [...best.values()]
    .filter((p) => p.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
}
