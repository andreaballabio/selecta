import type { SupabaseClient } from '@supabase/supabase-js'

// Colonne "ricche" (alcune dalla migrazione 0013). Se non esistono ancora, la
// select fallisce e si ricade sul set base → niente si rompe prima della migrazione.
const RICH = 'id, name, slug, primary_genre, secondary_genres, cataloged_tracks, accepts_unsolicited_demos, demo_submission_url, website_url, target_artist_level, response_time_days_avg, reachability_score, openness_score, release_cadence_12mo, reference_artists, last_release_date'
const BASE = 'id, name, slug, primary_genre, secondary_genres, cataloged_tracks, accepts_unsolicited_demos, demo_submission_url, website_url, target_artist_level, response_time_days_avg'
const PROFILE_COLS = 'label_id, confidence_score, analyzed_tracks_count, avg_spectral_centroid, avg_onset_strength, avg_sub_ratio, avg_mid_presence, avg_lufs, std_sub_ratio, std_onset_strength, std_spectral_centroid'

export type LabelRow = Record<string, any>
export type LabelProfile = Record<string, any>

async function selectLabels(sb: SupabaseClient, filter: (q: any) => any): Promise<LabelRow[]> {
  let res = await filter(sb.from('labels').select(RICH))
  if (res.error) res = await filter(sb.from('labels').select(BASE))
  return (res.data ?? []) as LabelRow[]
}

/** Directory: tutte le label con tracce + il loro profilo sonoro (per il mini-DNA). */
export async function fetchDirectory(sb: SupabaseClient): Promise<(LabelRow & { profile: LabelProfile | null })[]> {
  const labels = await selectLabels(sb, (q) => q.gt('cataloged_tracks', 0).order('cataloged_tracks', { ascending: false }))
  const { data: profiles } = await sb.from('label_profiles').select(PROFILE_COLS)
  const profById = new Map((profiles ?? []).map((p) => [p.label_id, p]))
  return labels.map((l) => ({ ...l, profile: profById.get(l.id) ?? null }))
}

/** Dettaglio: una label + profilo + ultime tracce analizzate. */
export async function fetchLabelDetail(sb: SupabaseClient, by: { id?: string; slug?: string }) {
  const rows = await selectLabels(sb, (q) => (by.id ? q.eq('id', by.id) : q.eq('slug', by.slug)).limit(1))
  const label = rows[0]
  if (!label) return null
  const [{ data: prof }, { data: tracks }] = await Promise.all([
    sb.from('label_profiles').select(PROFILE_COLS).eq('label_id', label.id).maybeSingle(),
    sb.from('label_ingestion_queue')
      .select('track_title, artist_name, release_date, audio_preview_url, spotify_album_image')
      .eq('label_id', label.id).eq('analysis_status', 'analyzed')
      .order('release_date', { ascending: false }).limit(12),
  ])
  return { label, profile: (prof as LabelProfile | null) ?? null, tracks: tracks ?? [] }
}
