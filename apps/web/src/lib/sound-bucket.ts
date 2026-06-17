/**
 * Sound bucket — classifica una traccia in UNA categoria di suono a partire dalle
 * feature audio (stessa fonte del Sound DNA). Serve a organizzare il catalogo
 * "per come suona" invece che con un firehose indistinto — è il collante di
 * Selecta (curation per suono). Deterministico: stesse feature → stesso bucket.
 *
 * Focus genere: Tech House. I bucket sono pensati per quel mondo.
 */
export interface BucketFeatures {
  bpm?: number | null
  onset_strength?: number | null
  sub_ratio?: number | null
  spectral_centroid?: number | null
  mid_presence?: number | null
}

export interface SoundBucket {
  key: string
  label: string
  blurb: string
}

export const BUCKETS: SoundBucket[] = [
  { key: 'peak-time',   label: 'Peak Time',        blurb: 'Energico, brillante, da pista piena' },
  { key: 'rolling-bass', label: 'Rolling Bass',    blurb: 'Sub profondo, basso che rotola' },
  { key: 'hypnotic',    label: 'Hypnotic / Deep',  blurb: 'Ipnotico, ridotto, in profondità' },
  { key: 'melodic',     label: 'Melodic',          blurb: 'Melodico, atmosferico, luminoso' },
  { key: 'groovy',      label: 'Groovy Tech House', blurb: 'Groove, swing, dritto in quattro' },
]

const BY_KEY: Record<string, SoundBucket> = Object.fromEntries(BUCKETS.map((b) => [b.key, b]))

export function bucketByKey(key: string | null | undefined): SoundBucket | null {
  return key ? BY_KEY[key] ?? null : null
}

/**
 * Assegna il bucket. Ordine di priorità pensato per non avere sovrapposizioni:
 * prima i caratteri più distintivi (sub dominante, ipnotico), poi peak-time,
 * poi melodico, infine il default groovy.
 */
export function deriveSoundBucket(f: BucketFeatures): SoundBucket {
  const onset = f.onset_strength ?? null
  const sub = f.sub_ratio ?? null
  const centroid = f.spectral_centroid ?? null

  if (sub != null && sub > 0.5) return BY_KEY['rolling-bass']
  if (onset != null && onset < 0.38) return BY_KEY['hypnotic']
  if (onset != null && onset > 0.62 && (centroid == null || centroid > 2800)) return BY_KEY['peak-time']
  if (centroid != null && centroid > 3600) return BY_KEY['melodic']
  return BY_KEY['groovy']
}
