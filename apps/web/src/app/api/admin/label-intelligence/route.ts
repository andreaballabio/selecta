import { NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { runLabelIntelligence } from '@/lib/label-intelligence-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Legge la Label Intelligence corrente (per il report in insights). */
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied
  const sb = createAdminClient()

  const lr = await sb.from('labels')
    .select('id, name, cataloged_tracks, generic_weight, distinctiveness, match_reliable, sound_family, nearest_label_id, intel_updated_at')
    .gt('cataloged_tracks', 0)
  if (lr.error) return NextResponse.json({ needsMigration: true, labels: [], snapshots: [] })

  const labels = (lr.data ?? []) as Record<string, unknown>[]
  const nameById = new Map(labels.map((l) => [l.id as string, l.name as string]))
  const { data: snaps } = await sb.from('label_intel_snapshots')
    .select('run_at, payload').order('run_at', { ascending: false }).limit(30)

  return NextResponse.json({
    labels: labels.map((l) => ({ ...l, nearest_name: l.nearest_label_id ? (nameById.get(l.nearest_label_id as string) ?? null) : null })),
    snapshots: snaps ?? [],
  })
}

/** Ricalcola subito (bottone "Ricalcola" in insights). */
export async function POST() {
  const denied = await requireAdminApi(); if (denied) return denied
  const sb = createAdminClient()
  try {
    const summary = await runLabelIntelligence(sb)
    return NextResponse.json({ ok: true, summary })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
