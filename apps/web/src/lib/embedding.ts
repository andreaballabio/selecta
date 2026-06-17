/** Utility condivise sugli embedding audio (64-dim) per similarità e centroidi. */

export function parseEmbedding(raw: unknown): number[] {
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map((v) => parseFloat(String(v))) : [] } catch { return [] }
  }
  if (Array.isArray(raw)) return (raw as (string | number)[]).map((v) => parseFloat(String(v)))
  return []
}

export function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) {
    const bi = b[i] ?? 0
    dot += a[i] * bi; na += a[i] * a[i]; nb += bi * bi
  }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

/** Centroide (media componente per componente) di un insieme di vettori. */
export function centroid(vectors: number[][]): number[] {
  const valid = vectors.filter((v) => v.length > 0)
  if (valid.length === 0) return []
  const dim = valid[0].length
  const out = new Array(dim).fill(0)
  for (const v of valid) for (let i = 0; i < dim; i++) out[i] += v[i] ?? 0
  for (let i = 0; i < dim; i++) out[i] /= valid.length
  return out
}
