import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

const MAX = 5

/** Aggiunge/rimuove una propria traccia dallo Spotlight del profilo (max 5). */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let submissionId = '', pin = true
  try {
    const b = await request.json()
    submissionId = typeof b.submission_id === 'string' ? b.submission_id : ''
    if (typeof b.pin === 'boolean') pin = b.pin
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: sub } = await sb.from('user_submissions').select('user_id, published').eq('id', submissionId).maybeSingle()
  if (!sub || (sub as { user_id: string }).user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: prof } = await sb.from('artist_profiles').select('id, spotlight').eq('user_id', user.id).maybeSingle()
  if (!prof) return NextResponse.json({ error: 'Crea prima la press kit' }, { status: 400 })

  const current: string[] = ((prof as { spotlight?: string[] }).spotlight ?? []).filter((x) => x !== submissionId)
  const next = pin ? [submissionId, ...current].slice(0, MAX) : current
  await sb.from('artist_profiles').update({ spotlight: next }).eq('id', (prof as { id: string }).id)

  return NextResponse.json({ ok: true, pinned: pin, spotlight: next })
}
