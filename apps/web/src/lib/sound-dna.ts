/**
 * Sound DNA — deriva descrittori e range BPM dalle analisi dell'utente
 * (user_submissions legate al suo account). Auto-popola la Press Kit con dati
 * REALI invece di parole inserite a mano.
 */
export interface SoundDnaRow {
  bpm?: number | null
  sub_ratio?: number | null
  mid_presence?: number | null
  spectral_centroid?: number | null
  onset_strength?: number | null
}

export interface SoundDna {
  trackCount: number
  bpmRange: string | null
  descriptors: string[]
}

export function deriveSoundDna(rows: SoundDnaRow[] | null | undefined): SoundDna | null {
  if (!rows || rows.length === 0) return null

  const col = (k: keyof SoundDnaRow) =>
    rows.map((r) => r[k]).filter((v): v is number => typeof v === 'number' && isFinite(v))
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null)

  const bpm = avg(col('bpm'))
  const centroid = avg(col('spectral_centroid'))
  const onset = avg(col('onset_strength'))
  const sub = avg(col('sub_ratio'))
  const mid = avg(col('mid_presence'))

  const descriptors: string[] = []
  if (centroid != null) descriptors.push(centroid > 3500 ? 'brillante' : centroid < 1800 ? 'dark' : 'equilibrato')
  if (onset != null) descriptors.push(onset > 0.6 ? 'percussivo' : onset < 0.35 ? 'ipnotico' : 'groovy')
  if (sub != null && sub > 0.45) descriptors.push('bass-heavy')
  if (mid != null && mid > 0.4) descriptors.push('ricco di medi')

  const bpmRange = bpm != null ? `${Math.round(bpm - 2)}-${Math.round(bpm + 2)}` : null

  return { trackCount: rows.length, bpmRange, descriptors }
}
