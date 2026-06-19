import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Calcola i punteggi A&R di una label DAI DATI (non a mano, come fa relesit):
 *   • openness   = quanto firma gente nuova (one-off + varietà artisti)
 *   • reachability = quanto è realistico farsi firmare (apertura + attività − prestigio)
 *   • cadence    = uscite negli ultimi 12 mesi
 *   • reference_artists = artisti più rappresentati
 *   • last_release_date = ultima uscita
 * Solo letture sulla coda + update della riga label → non tocca l'analisi in corso.
 */
const MS_YEAR = 365.25 * 24 * 3600 * 1000
const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v))

export interface LabelScores {
  reachability_score: number
  openness_score: number
  release_cadence_12mo: number
  reference_artists: string[]
  last_release_date: string | null
  difficulty: 'accessibile' | 'media' | 'difficile'
  reasons: string[]
}

/** Deriva i punteggi senza scrivere (utile per anteprime/test). */
export async function deriveLabelScores(supabase: SupabaseClient, labelId: string): Promise<LabelScores | null> {
  // catalogo della label (paginare oltre le 1000 righe)
  const rows: { artist_name: string | null; release_date: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('label_ingestion_queue')
      .select('artist_name, release_date')
      .eq('label_id', labelId)
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }
  if (rows.length === 0) return null

  const now = Date.now()
  const total = rows.length

  // conteggio per artista (normalizzato)
  const norm = (s: string | null) => (s ?? '').trim().toLowerCase()
  const byArtist = new Map<string, { count: number; display: string }>()
  for (const r of rows) {
    const k = norm(r.artist_name)
    if (!k) continue
    const e = byArtist.get(k) ?? { count: 0, display: (r.artist_name ?? '').trim() }
    e.count++
    byArtist.set(k, e)
  }
  const uniqueArtists = byArtist.size

  // ultima uscita + cadenza 12 mesi + uscite recenti (18 mesi)
  const dates = rows.map((r) => (r.release_date ? Date.parse(r.release_date) : NaN)).filter((t) => !isNaN(t))
  const last = dates.length ? new Date(Math.max(...dates)) : null
  const cadence12 = dates.filter((t) => now - t <= MS_YEAR).length
  const recentRows = rows.filter((r) => { const t = r.release_date ? Date.parse(r.release_date) : NaN; return !isNaN(t) && now - t <= 1.5 * MS_YEAR })

  // openness: quota di uscite recenti firmate da artisti "occasionali" (≤1 uscita totale)
  // + bonus per varietà (molti artisti diversi rispetto alle tracce)
  const recentOneOff = recentRows.filter((r) => (byArtist.get(norm(r.artist_name))?.count ?? 99) <= 1).length
  const oneOffRatio = recentRows.length ? recentOneOff / recentRows.length : (byArtist.size ? [...byArtist.values()].filter((a) => a.count <= 1).length / byArtist.size : 0)
  const varietyRatio = total ? uniqueArtists / total : 0
  const openness = Math.round(clamp(100 * (0.6 * oneOffRatio + 0.4 * varietyRatio)))

  // componenti reachability
  const cadenceScore = clamp(cadence12 * 8)          // ~12 uscite/anno → ~96
  const prestigeScore = clamp(total / 4)             // 400 tracce → 100 (più grande = più difficile)
  const reachability = Math.round(clamp(0.55 * openness + 0.25 * cadenceScore + 0.20 * (100 - prestigeScore)))

  const difficulty: LabelScores['difficulty'] = reachability >= 66 ? 'accessibile' : reachability >= 33 ? 'media' : 'difficile'

  const reference_artists = [...byArtist.values()].sort((a, b) => b.count - a.count).slice(0, 4).map((a) => a.display).filter(Boolean)

  // spiegazioni leggibili
  const reasons: string[] = []
  reasons.push(openness >= 60 ? 'firma spesso gente nuova' : openness >= 35 ? 'mix di nomi noti e nuovi' : 'firma soprattutto i suoi artisti')
  reasons.push(cadence12 >= 24 ? 'molto attiva' : cadence12 >= 8 ? 'attiva' : 'poche uscite recenti')
  if (prestigeScore >= 75) reasons.push('catalogo grande/affermato')

  return {
    reachability_score: reachability,
    openness_score: openness,
    release_cadence_12mo: cadence12,
    reference_artists,
    last_release_date: last ? last.toISOString().slice(0, 10) : null,
    difficulty,
    reasons,
  }
}

/** Calcola e SALVA i punteggi sulla riga label. */
export async function computeLabelScores(supabase: SupabaseClient, labelId: string): Promise<LabelScores | null> {
  const s = await deriveLabelScores(supabase, labelId)
  if (!s) return null
  await supabase.from('labels').update({
    reachability_score: s.reachability_score,
    openness_score: s.openness_score,
    release_cadence_12mo: s.release_cadence_12mo,
    reference_artists: s.reference_artists,
    last_release_date: s.last_release_date,
    scores_updated_at: new Date().toISOString(),
  }).eq('id', labelId)
  return s
}

/** Etichetta difficoltà a partire da reachability (per la UI). */
export function difficultyOf(reachability: number | null | undefined): 'accessibile' | 'media' | 'difficile' | null {
  if (reachability == null) return null
  return reachability >= 66 ? 'accessibile' : reachability >= 33 ? 'media' : 'difficile'
}
