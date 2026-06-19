import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { buildLabelProfile } from '@/lib/label-profile'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!
)

export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const { searchParams } = new URL(request.url)
  const label_id = searchParams.get('label_id')
  if (!label_id) return NextResponse.json({ error: 'label_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('label_profiles')
    .select('*')
    .eq('label_id', label_id)
    .single()

  if (error || !data) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile: data })
}

export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const { label_id } = await request.json()
    if (!label_id) return NextResponse.json({ error: 'label_id required' }, { status: 400 })

    const res = await buildLabelProfile(supabase, label_id)
    if (!res.ok) return NextResponse.json({ error: res.error ?? 'Profilo non creato' }, { status: 400 })

    return NextResponse.json({
      success: true,
      confidence_score: res.confidence_score,
      analyzed_tracks_count: res.analyzed_tracks_count,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
