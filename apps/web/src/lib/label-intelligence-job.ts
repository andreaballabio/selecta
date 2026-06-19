import type { SupabaseClient } from '@supabase/supabase-js'
import { cosine, meanCenter } from './eval-matching'
import { deriveIntel, bestAlpha, type LabelAgg, type ScoredQuery } from './label-intelligence'

const MAX = 2500   // tetto per l'O(n²)
const TOPK = 5
const MIN_TRACKS = 3

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
  avgHit5: number
  mostGeneric: { name: string; genericWeight: number }[]
  leastReliable: { name: string; hit5: number; similar: string | null }[]
  familyList: { name: string; size: number; members: string[] }[]
  downWeight: { on: boolean; alpha: number; precisionByAlpha: { alpha: number; p: number }[] }
}

/**
 * Calcola la Label Intelligence dai DATI DI CONFUSIONE reali (leave-one-out sul
 * campione di tracce), la salva su `labels` e registra uno snapshot. Automatico,
 * idempotente, pensato per il cron notturno.
 */
export async function runLabelIntelligence(sb: SupabaseClient): Promise<IntelSummary> {
  // Nomi label + totale tracce.
  const { data: labs } = await sb.from('labels').select('id, name, cataloged_tracks').gt('cataloged_tracks', 0)
  const nameOf = new Map((labs ?? []).map((l) => [l.id as string, (l.name as string) ?? '?']))
  const tracksOf = new Map((labs ?? []).map((l) => [l.id as string, (l.cataloged_tracks as number) ?? 0]))

  // Campione di tracce analizzate.
  const rows: { label_id: string; audio_embedding: unknown }[] = []
  for (let from = 0; ; from += 1000) {
    const { data } = await sb.from('label_ingestion_queue')
      .select('label_id, audio_embedding').eq('analysis_status', 'analyzed')
      .not('audio_embedding', 'is', null).range(from, from + 999)
    if (!data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }
  let cat = rows.map((r) => ({ labelId: r.label_id, emb: parseEmb(r.audio_embedding) })).filter((t) => t.labelId && t.emb.length === 64)
  if (cat.length > MAX) {
    for (let i = cat.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[cat[i], cat[j]] = [cat[j], cat[i]] }
    cat = cat.slice(0, MAX)
  }

  const centered = meanCenter(cat.map((t) => t.emb)).centered
  const byLabel = new Map<string, number[]>()
  cat.forEach((t, i) => { const a = byLabel.get(t.labelId) ?? []; a.push(i); byLabel.set(t.labelId, a) })
  const eligible = [...byLabel.keys()].filter((l) => (byLabel.get(l)?.length ?? 0) >= MIN_TRACKS)

  // Leave-one-out: rank della label vera (precision/hit) + #1 predetta (confusione).
  type Agg = { n: number; hit5: number; confusion: Map<string, number> }
  const agg = new Map<string, Agg>()
  const queries: ScoredQuery[] = []
  let hit1 = 0, hit5all = 0, rr = 0, total = 0
  for (const qi of eligible.flatMap((l) => byLabel.get(l)!)) {
    const home = cat[qi].labelId
    const qv = centered[qi]
    const scored: { label: string; score: number }[] = []
    for (const L of eligible) {
      const idxs = byLabel.get(L)!
      const sims: number[] = []
      for (const j of idxs) { if (j === qi) continue; sims.push(cosine(qv, centered[j])) }
      if (!sims.length) continue
      sims.sort((a, b) => b - a)
      const k = Math.min(TOPK, sims.length)
      let s = 0; for (let m = 0; m < k; m++) s += sims[m]
      scored.push({ label: L, score: s / k })
    }
    queries.push({ home, scores: scored.map((s) => ({ id: s.label, score: s.score })) })
    scored.sort((a, b) => b.score - a.score)
    const rank = scored.findIndex((s) => s.label === home) + 1
    const pred = scored[0]?.label
    total++
    if (rank === 1) hit1++
    if (rank >= 1 && rank <= 5) hit5all++
    if (rank >= 1) rr += 1 / rank
    const a = agg.get(home) ?? { n: 0, hit5: 0, confusion: new Map() }
    a.n++
    if (rank >= 1 && rank <= 5) a.hit5++
    if (pred && pred !== home) a.confusion.set(pred, (a.confusion.get(pred) ?? 0) + 1)
    agg.set(home, a)
  }

  // Aggregati → deriveIntel.
  const labelAggs: LabelAgg[] = [...agg.entries()].map(([id, a]) => ({
    id, name: nameOf.get(id) ?? id.slice(0, 8), tracks: tracksOf.get(id) ?? a.n, n: a.n,
    hit5: a.n ? a.hit5 / a.n : 0,
    confusion: [...a.confusion.entries()].map(([tid, count]) => ({ id: tid, name: nameOf.get(tid) ?? tid.slice(0, 8), count })),
  }))
  const { metrics, families } = deriveIntel(labelAggs)

  // AUTO-VALIDAZIONE: quanto smorzare le calamite SENZA peggiorare la precision.
  // Se anche il minimo smorzamento peggiora → alpha=0 → peso effettivo 1 (spento).
  const weightMap = new Map(metrics.map((m) => [m.id, m.genericWeight]))
  const { alpha, precisionByAlpha } = bestAlpha(queries, weightMap, [0, 0.4, 0.7, 1], 5)
  const effWeight = (genericWeight: number) => Math.round(Math.pow(genericWeight, alpha) * 1000) / 1000

  // Persisti per label (best-effort: si ferma se le colonne non esistono).
  for (const m of metrics) {
    const { error } = await sb.from('labels').update({
      generic_weight: effWeight(m.genericWeight),
      distinctiveness: m.hit5,          // ora = hit@5 reale (riconoscibilità)
      match_reliable: m.reliable,
      nearest_label_id: m.similarToId,
      sound_family: m.family,
      intel_updated_at: new Date().toISOString(),
    }).eq('id', m.id)
    if (error) break
  }

  // Snapshot storico.
  const avgHit5 = metrics.length ? metrics.reduce((s, m) => s + m.hit5, 0) / metrics.length : 0
  const summary: IntelSummary = {
    labels: metrics.length,
    families: families.length,
    precisionAt1: total ? Math.round((hit1 / total) * 1000) / 1000 : 0,
    precisionAt5: total ? Math.round((hit5all / total) * 1000) / 1000 : 0,
    mrr: total ? Math.round((rr / total) * 1000) / 1000 : 0,
    avgHit5: Math.round(avgHit5 * 1000) / 1000,
    mostGeneric: [...metrics].sort((a, b) => a.genericWeight - b.genericWeight).slice(0, 6).map((m) => ({ name: m.name, genericWeight: m.genericWeight })),
    leastReliable: metrics.filter((m) => !m.reliable).sort((a, b) => a.hit5 - b.hit5).map((m) => ({ name: m.name, hit5: m.hit5, similar: m.similarToName })),
    familyList: families.map((f) => ({ name: f.name, size: f.members.length, members: f.members.map((m) => m.name) })),
    downWeight: { on: alpha > 0, alpha, precisionByAlpha },
  }
  await sb.from('label_intel_snapshots').insert({ payload: summary }).then(() => {}, () => {})
  return summary
}
