import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

/** Stato globale + per-label della coda di analisi (per l'indicatore in navbar). */
export async function GET() {
  // PostgREST limita a 1000 righe per richiesta → con migliaia di tracce i
  // conteggi venivano TRONCATI (totale fermo a 1000, label mancanti). Paginiamo
  // con .range() finché non finiscono le righe, così contiamo TUTTO davvero.
  const PAGE = 1000
  const rows: { label_id: string; status: string | null; analysis_status: string | null }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('label_ingestion_queue')
      .select('label_id, status, analysis_status')
      .range(from, from + PAGE - 1)
    if (error || !data || data.length === 0) break
    rows.push(...(data as typeof rows))
    if (data.length < PAGE) break
  }
  const { data: labels } = await supabase.from('labels').select('id, name')

  const nameOf = new Map((labels ?? []).map((l) => [l.id, l.name]))
  const g = { total: 0, analyzed: 0, analyzing: 0, pending: 0, failed: 0 }
  const per = new Map<string, { name: string; total: number; analyzed: number; analyzing: number; pending: number; failed: number }>()

  for (const r of rows ?? []) {
    const matched = r.status === 'matched'
    const isPending = matched && (r.analysis_status === 'pending' || r.analysis_status === null || r.analysis_status === '')
    const isAnalyzing = r.analysis_status === 'analyzing'
    const isAnalyzed = r.analysis_status === 'analyzed'
    const isFailed = r.analysis_status === 'failed'

    g.total++
    if (isAnalyzed) g.analyzed++
    else if (isAnalyzing) g.analyzing++
    else if (isFailed) g.failed++
    else if (isPending) g.pending++

    const key = r.label_id as string
    if (!per.has(key)) per.set(key, { name: nameOf.get(key) ?? '—', total: 0, analyzed: 0, analyzing: 0, pending: 0, failed: 0 })
    const p = per.get(key)!
    p.total++
    if (isAnalyzed) p.analyzed++
    else if (isAnalyzing) p.analyzing++
    else if (isFailed) p.failed++
    else if (isPending) p.pending++
  }

  const labelsOut = [...per.values()]
    .filter((p) => p.total > 0)
    .sort((a, b) => (b.pending + b.analyzing) - (a.pending + a.analyzing) || b.total - a.total)

  const remaining = g.pending + g.analyzing
  return NextResponse.json({
    global: g,
    remaining,
    working: remaining > 0,
    progress: g.total > 0 ? Math.round((g.analyzed / g.total) * 100) : 100,
    labels: labelsOut,
  })
}
