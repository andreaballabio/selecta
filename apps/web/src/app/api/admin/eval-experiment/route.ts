import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluatePrecision, type EvalTrack } from '@/lib/eval-matching'
import { dz, sleep, DZ_THROTTLE_MS } from '@/lib/deezer'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'
const CHUNK = 10
const PER_LABEL = 12 // tracce per label nel campione (per avere abbastanza per il leave-one-out)

type Row = { label_id: string; audio_preview_url: string | null; source: string | null; source_id: string | null }

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

/**
 * Esperimento A/B dimensione embedding (64 vs 256), NON distruttivo.
 * - Campione CASUALE per label (diverso a ogni run).
 * - Rigenera le PREVIEW fresche da Deezer (gli URL salvati scadono in ~1 giorno),
 *   così il worker riesce sempre a scaricare l'audio.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const n = Math.min(Math.max(Number(new URL(request.url).searchParams.get('n') ?? 90) || 90, 20), 160)

  const sb = createAdminClient()
  const { data, error } = await sb.from('label_ingestion_queue')
    .select('label_id, audio_preview_url, source, source_id')
    .eq('analysis_status', 'analyzed')
    .limit(6000)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Raggruppa per label, tieni solo label con >=3 tracce.
  const byLabel = new Map<string, Row[]>()
  for (const r of (data ?? []) as Row[]) {
    const arr = byLabel.get(r.label_id) ?? []
    arr.push(r); byLabel.set(r.label_id, arr)
  }
  // Campione casuale: label a caso, fino a ~n tracce (max PER_LABEL a label).
  const labelIds = shuffle([...byLabel.keys()].filter((id) => (byLabel.get(id)?.length ?? 0) >= 3))
  const sample: Row[] = []
  for (const id of labelIds) {
    if (sample.length >= n) break
    sample.push(...shuffle(byLabel.get(id)!).slice(0, PER_LABEL))
  }

  // Preview fresche da Deezer (con throttle anti-quota). Fallback all'URL salvato.
  const items: { label_id: string; url: string }[] = []
  for (const r of sample) {
    let url = r.audio_preview_url ?? null
    if (r.source === 'deezer' && r.source_id) {
      const j = await dz(`track/${r.source_id}`)
      if (j?.preview) url = j.preview
      await sleep(DZ_THROTTLE_MS)
    }
    if (url) items.push({ label_id: r.label_id, url })
  }

  // Ri-embedda dal worker a blocchi (chunk piccoli → nessun timeout del gateway HF).
  const cat64: EvalTrack[] = []
  const cat256: EvalTrack[] = []
  let workerErrors = 0
  for (let i = 0; i < items.length; i += CHUNK) {
    try {
      const wr = await fetch(`${WORKER_URL}/experiment/embed-batch`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: items.slice(i, i + CHUNK) }), signal: AbortSignal.timeout(90_000),
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
    requested: items.length,
    embedded: cat64.length,
    workerErrors,
    dim64: { p1: dim64.precisionAt1, p3: dim64.precisionAt3, p5: dim64.precisionAt5, mrr: dim64.mrr, labels: dim64.labelsCovered },
    dim256: { p1: dim256.precisionAt1, p3: dim256.precisionAt3, p5: dim256.precisionAt5, mrr: dim256.mrr, labels: dim256.labelsCovered },
  })
}
