import type { SupabaseClient } from '@supabase/supabase-js'
import { labelMetrics, soundFamilies, type LabelVec } from './label-intelligence'
import { evaluatePrecision, type EvalTrack } from './eval-matching'

function parseEmb(raw: unknown): number[] {
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [] } catch { return [] } }
  if (Array.isArray(raw)) return (raw as unknown[]).map(Number)
  return []
}

export interface IntelSummary {
  labels: number
  families: number
  precisionAt1: number
  precisionAt5: number
  mrr: number
  avgDistinctiveness: number
  mostGeneric: { name: string; genericWeight: number }[]
  leastReliable: { name: string; distinctiveness: number; nearest: string | null }[]
  familyList: { name: string; size: number; members: string[] }[]
}

/**
 * Calcola la Label Intelligence dai centroidi (label_profiles.avg_embedding),
 * la SALVA su `labels`, e registra uno snapshot storico. Idempotente, automatico.
 * Pensata per girare dal cron notturno. Scala a centinaia di label (O(label²)).
 */
export async function runLabelIntelligence(sb: SupabaseClient): Promise<IntelSummary> {
  // 1) Label + centroidi.
  const [{ data: labs }, { data: profs }] = await Promise.all([
    sb.from('labels').select('id, name, cataloged_tracks').gt('cataloged_tracks', 0),
    sb.from('label_profiles').select('label_id, avg_embedding, analyzed_tracks_count'),
  ])
  const profOf = new Map((profs ?? []).map((p) => [p.label_id as string, p]))
  const vecs: LabelVec[] = (labs ?? []).map((l) => {
    const p = profOf.get(l.id as string)
    return {
      id: l.id as string,
      name: (l.name as string) ?? '?',
      tracks: (l.cataloged_tracks as number) ?? (p?.analyzed_tracks_count as number) ?? 0,
      centroid: parseEmb(p?.avg_embedding),
    }
  }).filter((v) => v.centroid.length > 0)

  const metrics = labelMetrics(vecs)
  const families = soundFamilies(vecs, 0.5)
  const familyOf = new Map<string, string>()
  for (const f of families) for (const m of f.members) familyOf.set(m.id, f.name)

  // 2) Precision@k campionata (trend "accuratezza nel tempo").
  let precisionAt1 = 0, precisionAt5 = 0, mrr = 0
  try {
    const rows: { label_id: string; audio_embedding: unknown }[] = []
    for (let from = 0; from < 1500; from += 1000) {
      const { data } = await sb.from('label_ingestion_queue')
        .select('label_id, audio_embedding').eq('analysis_status', 'analyzed')
        .not('audio_embedding', 'is', null).range(from, from + 999)
      if (!data || data.length === 0) break
      rows.push(...(data as typeof rows))
      if (data.length < 1000) break
    }
    const cat: EvalTrack[] = rows.map((r) => ({ labelId: r.label_id, embedding: parseEmb(r.audio_embedding) })).filter((t) => t.labelId && t.embedding.length === 64)
    const pr = evaluatePrecision(cat, { minTracksPerLabel: 3, topKWindows: 5, center: true })
    precisionAt1 = pr.precisionAt1; precisionAt5 = pr.precisionAt5; mrr = pr.mrr
  } catch { /* la precision è opzionale per il trend */ }

  // 3) Persisti i valori per label (best-effort: ignora se le colonne non esistono).
  for (const m of metrics) {
    const { error } = await sb.from('labels').update({
      generic_weight: m.genericWeight,
      distinctiveness: m.distinctiveness,
      match_reliable: m.reliable,
      nearest_label_id: m.nearestId,
      sound_family: familyOf.get(m.id) ?? null,
      intel_updated_at: new Date().toISOString(),
    }).eq('id', m.id)
    if (error) break // colonne assenti (migrazione 0017 non eseguita) → fermati, niente crash
  }

  // 4) Snapshot per lo storico in insights.
  const avgDistinctiveness = metrics.length ? metrics.reduce((s, m) => s + m.distinctiveness, 0) / metrics.length : 0
  const mostGeneric = [...metrics].sort((a, b) => a.genericWeight - b.genericWeight).slice(0, 6)
    .map((m) => ({ name: m.name, genericWeight: m.genericWeight }))
  const leastReliable = metrics.filter((m) => !m.reliable).sort((a, b) => a.distinctiveness - b.distinctiveness)
    .map((m) => ({ name: m.name, distinctiveness: m.distinctiveness, nearest: m.nearestName }))
  const familyList = families.map((f) => ({ name: f.name, size: f.members.length, members: f.members.map((m) => m.name) }))

  const summary: IntelSummary = {
    labels: metrics.length,
    families: families.length,
    precisionAt1: Math.round(precisionAt1 * 1000) / 1000,
    precisionAt5: Math.round(precisionAt5 * 1000) / 1000,
    mrr: Math.round(mrr * 1000) / 1000,
    avgDistinctiveness: Math.round(avgDistinctiveness * 1000) / 1000,
    mostGeneric, leastReliable, familyList,
  }
  await sb.from('label_intel_snapshots').insert({ payload: summary }).then(() => {}, () => {})
  return summary
}
