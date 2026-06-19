import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { cosine, meanCenter } from '@/lib/eval-matching'
import { coherencePct } from '@/lib/label-display'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const MAX = 2500   // tetto per l'O(n²) — campione casuale oltre questa soglia
const TOPK = 5

function parseEmb(raw: unknown): number[] {
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [] } catch { return [] } }
  if (Array.isArray(raw)) return (raw as unknown[]).map(Number)
  return []
}

/**
 * Diagnostica "salute" delle label: per ognuna calcola accuratezza di match,
 * coerenza del suono, diversità di artisti e — chiave — verso QUALI altre label
 * vengono confuse le sue tracce. Serve a capire PERCHÉ una label è debole
 * (eclettica? duplicato di un'altra? pochi dati?). Sola lettura.
 */
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied
  const sb = createAdminClient()

  // 1) Tracce analizzate (embedding + artista).
  const rows: { label_id: string; audio_embedding: unknown; artist_name: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from('label_ingestion_queue')
      .select('label_id, audio_embedding, artist_name')
      .eq('analysis_status', 'analyzed').not('audio_embedding', 'is', null)
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < 1000) break
  }

  // 2) Nomi label + profili (coerenza).
  const [{ data: labs }, { data: profs }] = await Promise.all([
    sb.from('labels').select('id, name, primary_genre'),
    sb.from('label_profiles').select('label_id, std_spectral_centroid, std_sub_ratio, std_onset_strength, confidence_score'),
  ])
  const nameOf = new Map((labs ?? []).map((l) => [l.id, { name: l.name as string, genre: (l.primary_genre as string) ?? '' }]))
  const profOf = new Map((profs ?? []).map((p) => [p.label_id, p]))

  // 3) Conteggi su TUTTO il catalogo (tracce + diversità artisti per label).
  const totalsByLabel = new Map<string, { tracks: number; artists: Set<string> }>()
  for (const r of rows) {
    const t = totalsByLabel.get(r.label_id) ?? { tracks: 0, artists: new Set<string>() }
    t.tracks++
    const a = (r.artist_name ?? '').trim().toLowerCase(); if (a) t.artists.add(a)
    totalsByLabel.set(r.label_id, t)
  }

  // 4) Campione (casuale se troppo grande) per la matematica O(n²).
  let cat = rows.map((r) => ({ labelId: r.label_id, emb: parseEmb(r.audio_embedding) })).filter((t) => t.labelId && t.emb.length === 64)
  const totalAnalyzed = cat.length
  if (cat.length > MAX) {
    for (let i = cat.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[cat[i], cat[j]] = [cat[j], cat[i]] }
    cat = cat.slice(0, MAX)
  }

  const centered = meanCenter(cat.map((t) => t.emb)).centered
  const byLabel = new Map<string, number[]>()
  cat.forEach((t, i) => { const arr = byLabel.get(t.labelId) ?? []; arr.push(i); byLabel.set(t.labelId, arr) })
  const eligible = [...byLabel.keys()].filter((l) => (byLabel.get(l)?.length ?? 0) >= 3)

  // 5) Leave-one-out: rank della label vera + label predetta (#1) per la confusione.
  type Agg = { n: number; hit5: number; rankSum: number; confusion: Map<string, number> }
  const agg = new Map<string, Agg>()
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
    scored.sort((a, b) => b.score - a.score)
    const rank = scored.findIndex((s) => s.label === home) + 1
    const pred = scored[0]?.label
    const a = agg.get(home) ?? { n: 0, hit5: 0, rankSum: 0, confusion: new Map() }
    a.n++
    if (rank >= 1 && rank <= 5) a.hit5++
    a.rankSum += rank >= 1 ? rank : eligible.length
    if (pred && pred !== home) a.confusion.set(pred, (a.confusion.get(pred) ?? 0) + 1)
    agg.set(home, a)
  }

  // 6) Output per label, ordinato dal più debole.
  const labels = [...agg.entries()].map(([id, a]) => {
    const tot = totalsByLabel.get(id)
    const prof = profOf.get(id)
    const meta = nameOf.get(id)
    const confusion = [...a.confusion.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3)
      .map(([lid, c]) => ({ label: nameOf.get(lid)?.name ?? lid.slice(0, 8), pct: Math.round((c / a.n) * 100) }))
    return {
      name: meta?.name ?? id.slice(0, 8),
      genre: meta?.genre ?? '',
      tracksTotal: tot?.tracks ?? 0,
      uniqueArtists: tot?.artists.size ?? 0,
      artistDiversity: tot && tot.tracks ? Math.round((tot.artists.size / tot.tracks) * 100) / 100 : null,
      coherence: coherencePct(prof as Record<string, unknown> | null),
      confidence: prof ? Math.round((prof.confidence_score ?? 0) * 100) / 100 : null,
      sampleN: a.n,
      hitTop5: Math.round((a.hit5 / a.n) * 100) / 100,
      avgRank: Math.round((a.rankSum / a.n) * 10) / 10,
      confusedWith: confusion,
    }
  }).sort((x, y) => x.hitTop5 - y.hitTop5)

  const healthy = labels.filter((l) => l.hitTop5 >= 0.66).length
  const weak = labels.filter((l) => l.hitTop5 < 0.33).length
  return NextResponse.json({
    tool: 'selecta-label-health',
    totalAnalyzedTracks: totalAnalyzed,
    sampleUsed: cat.length,
    eligibleLabels: eligible.length,
    summary: { healthy, mid: labels.length - healthy - weak, weak },
    labels,
  })
}
