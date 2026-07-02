// Helper di visualizzazione per le label (directory + dettaglio + report match).
// Niente dipendenze: pure funzioni su profilo/punteggi.

export type Tone = 'accent' | 'yellow' | 'red' | 'muted'

export function difficultyMeta(reach?: number | null): { label: string; tone: Tone } {
  if (reach == null) return { label: '—', tone: 'muted' }
  if (reach >= 66) return { label: 'Accessibile', tone: 'accent' }
  if (reach >= 33) return { label: 'Media', tone: 'yellow' }
  return { label: 'Difficile', tone: 'red' }
}

export const toneClass: Record<Tone, string> = {
  accent: 'bg-accent/15 text-accent',
  yellow: 'bg-warn/10 text-warn',
  red: 'bg-danger/10 text-danger',
  muted: 'bg-surface-2 text-muted',
}

// Range fissi (tech house) per normalizzare ogni feature a 0-100 senza dipendere dal resto del catalogo.
const RANGES = { brightness: [2400, 3800], punch: [0.45, 0.6], sub: [0.28, 0.4], mid: [0.17, 0.32], loud: [-13, -8] } as const
const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const nrm = (v: number | null | undefined, [lo, hi]: readonly [number, number]) => (v == null ? 0 : Math.round(clamp01((v - lo) / (hi - lo)) * 100))

export interface Bar { label: string; pct: number }

export function coherencePct(p: Record<string, any> | null): number | null {
  if (!p) return null
  const refs: [number | null | undefined, number, number][] = [
    [p.std_spectral_centroid, 1400, 500],
    [p.std_sub_ratio, 0.18, 0.08],
    [p.std_onset_strength, 0.2, 0.1],
  ]
  let s = 0, c = 0
  for (const [v, hi, lo] of refs) { if (v != null) { s += clamp01((hi - v) / (hi - lo)); c++ } }
  return c ? Math.round((s / c) * 100) : null
}

export function featureBars(p: Record<string, any> | null): Bar[] {
  if (!p) return []
  const bars: Bar[] = [
    { label: 'Brillantezza', pct: nrm(p.avg_spectral_centroid, RANGES.brightness) },
    { label: 'Percussività', pct: nrm(p.avg_onset_strength, RANGES.punch) },
    { label: 'Sub-bass', pct: nrm(p.avg_sub_ratio, RANGES.sub) },
    { label: 'Medi', pct: nrm(p.avg_mid_presence, RANGES.mid) },
    { label: 'Loudness', pct: nrm(p.avg_lufs, RANGES.loud) },
  ]
  const coh = coherencePct(p)
  if (coh != null) bars.push({ label: 'Coerenza', pct: coh })
  return bars
}

/** Tag brevi e leggibili sul carattere del suono. */
export function soundTags(p: Record<string, any> | null): string[] {
  if (!p) return []
  const bars = featureBars(p)
  const get = (l: string) => bars.find((b) => b.label === l)?.pct ?? 50
  const tags: string[] = []
  if (get('Brillantezza') >= 66) tags.push('brillante'); else if (get('Brillantezza') <= 33) tags.push('scuro')
  if (get('Percussività') >= 66) tags.push('punchy'); else if (get('Percussività') <= 33) tags.push('morbido')
  if (get('Sub-bass') >= 66) tags.push('sub-heavy')
  if (get('Coerenza') >= 70) tags.push('identitaria')
  return tags.slice(0, 3)
}

export function relativeDate(d?: string | null): string {
  if (!d) return '—'
  const t = Date.parse(d)
  if (isNaN(t)) return '—'
  const days = Math.floor((Date.now() - t) / 86_400_000)
  if (days <= 0) return 'oggi'
  if (days < 30) return `${days}g fa`
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`
  return `${Math.floor(days / 365)} anni fa`
}
