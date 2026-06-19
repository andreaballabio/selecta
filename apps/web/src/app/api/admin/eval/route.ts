import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { evaluatePrecision, type EvalTrack } from '@/lib/eval-matching'
import { versionInfo } from '@/lib/embedding-version'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Cap di sicurezza: la valutazione è O(n²). Oltre questa soglia campioniamo in
// modo deterministico (equispaziato) per restare nei tempi del serverless.
const MAX_TRACKS = 1800

function parseEmb(raw: unknown): number[] {
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [] } catch { return [] } }
  if (Array.isArray(raw)) return (raw as unknown[]).map(Number)
  return []
}

/**
 * Validazione del matching sul catalogo reale (leave-one-out → precision@k).
 * Solo admin, sola lettura. Dà il NUMERO di credibilità dell'algoritmo.
 */
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied

  const sb = createAdminClient()

  // La colonna embedding_version esiste? (post-migrazione 0014). Se no, niente diagnostica versione.
  const probe = await sb.from('label_ingestion_queue').select('embedding_version').limit(1)
  const cols = probe.error ? 'label_id, audio_embedding' : 'label_id, audio_embedding, embedding_version'

  const rows: { label_id: string; audio_embedding: unknown; embedding_version?: string | null }[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('label_ingestion_queue')
      .select(cols)
      .eq('analysis_status', 'analyzed')
      .not('audio_embedding', 'is', null)
      .range(from, from + 999)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    if (!data || data.length === 0) break
    rows.push(...(data as unknown as typeof rows))
    if (data.length < 1000) break
  }
  const version = versionInfo(rows)

  let catalog: EvalTrack[] = rows
    .map((r) => ({ labelId: r.label_id, embedding: parseEmb(r.audio_embedding) }))
    .filter((t) => t.labelId && t.embedding.length === 64)

  const loaded = catalog.length
  let sampled = false
  if (catalog.length > MAX_TRACKS) {
    const step = catalog.length / MAX_TRACKS
    catalog = Array.from({ length: MAX_TRACKS }, (_, k) => catalog[Math.floor(k * step)])
    sampled = true
  }

  const result = evaluatePrecision(catalog, { minTracksPerLabel: 3, topKWindows: 5, center: true })
  return NextResponse.json({ ...result, tracksLoaded: loaded, sampled, version })
}
