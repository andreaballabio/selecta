import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

const RICH = 'id, name, accepts_unsolicited_demos, demo_submission_url, website_url, response_time_days_avg, target_artist_level, reachability_score, openness_score, release_cadence_12mo, reference_artists, last_release_date, scores_updated_at'
const BASE = 'id, name, accepts_unsolicited_demos, demo_submission_url, website_url, response_time_days_avg, target_artist_level'

export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const id = new URL(request.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
  let res = await supabase.from('labels').select(RICH).eq('id', id).maybeSingle()
  if (res.error) res = await supabase.from('labels').select(BASE).eq('id', id).maybeSingle()
  if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
  return NextResponse.json({ label: res.data })
}

// Salva solo i campi curati a mano (i punteggi sono calcolati, non editabili qui)
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const body = await request.json()
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })
  const patch: Record<string, unknown> = {}
  for (const k of ['accepts_unsolicited_demos', 'demo_submission_url', 'website_url', 'response_time_days_avg', 'target_artist_level'] as const) {
    if (k in body) patch[k] = body[k] === '' ? null : body[k]
  }
  const { error } = await supabase.from('labels').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
