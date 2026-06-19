import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluatePrecision, type EvalTrack } from '@/lib/eval-matching'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'
const CHUNK = 10

/**
 * Esperimento A/B sulla DIMENSIONE dell'embedding (64 vs 256), NON distruttivo.
 * Campiona N tracce col preview, le fa ri-embeddare dal worker a 64 e 256 dim, e
 * confronta precision@k. Serve a decidere se vale la migrazione a 256 PRIMA di farla.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const n = Math.min(Math.max(Number(new URL(request.url).searchParams.get('n') ?? 100) || 100, 20), 200)

  const sb = createAdminClient()
  const { data, error } = await sb.from('label_ingestion_queue')
    .select('label_id, audio_preview_url')
    .eq('analysis_status', 'analyzed')
    .not('audio_preview_url', 'is', null)
    .limit(4000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Tieni solo label con >=3 tracce (servono per il leave-one-out), poi campiona a N.
  let rows = (data ?? []) as { label_id: string; audio_preview_url: string }[]
  const cnt = new Map<string, number>()
  for (const r of rows) cnt.set(r.label_id, (cnt.get(r.label_id) ?? 0) + 1)
  rows = rows.filter((r) => (cnt.get(r.label_id) ?? 0) >= 3)
  if (rows.length > n) {
    const step = rows.length / n
    rows = Array.from({ length: n }, (_, k) => rows[Math.floor(k * step)])
  }

  // Ri-embedda dal worker a blocchi (chunk piccoli → nessun timeout del gateway HF).
  const cat64: EvalTrack[] = []
  const cat256: EvalTrack[] = []
  let workerErrors = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const items = rows.slice(i, i + CHUNK).map((r) => ({ label_id: r.label_id, url: r.audio_preview_url }))
    try {
      const wr = await fetch(`${WORKER_URL}/experiment/embed-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items }), signal: AbortSignal.timeout(90_000),
      })
      if (!wr.ok) { workerErrors++; continue }
      const wd = await wr.json() as { results?: { label_id: string; e64: number[]; e256: number[] }[] }
      for (const it of wd.results ?? []) {
        if (Array.isArray(it.e64) && it.e64.length) cat64.push({ labelId: it.label_id, embedding: it.e64 })
        if (Array.isArray(it.e256) && it.e256.length) cat256.push({ labelId: it.label_id, embedding: it.e256 })
      }
    } catch { workerErrors++ }
  }

  const dim64 = evaluatePrecision(cat64, { minTracksPerLabel: 3, topKWindows: 5, center: true })
  const dim256 = evaluatePrecision(cat256, { minTracksPerLabel: 3, topKWindows: 5, center: true })

  return NextResponse.json({
    requested: rows.length,
    embedded: cat64.length,
    workerErrors,
    dim64: { p1: dim64.precisionAt1, p3: dim64.precisionAt3, p5: dim64.precisionAt5, mrr: dim64.mrr, labels: dim64.labelsCovered },
    dim256: { p1: dim256.precisionAt1, p3: dim256.precisionAt3, p5: dim256.precisionAt5, mrr: dim256.mrr, labels: dim256.labelsCovered },
  })
}
