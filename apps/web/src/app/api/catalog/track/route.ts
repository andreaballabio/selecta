import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/** Modifica i campi di una propria traccia pubblicata (metadata, visibilità). */
export async function PATCH(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const id = typeof body.submission_id === 'string' ? body.submission_id : ''
  if (!id) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: sub } = await sb.from('user_submissions').select('id, user_id').eq('id', id).maybeSingle()
  if (!sub || (sub as { user_id: string }).user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = {}
  const str = (k: string, max = 200) => { if (typeof body[k] === 'string') patch[k] = (body[k] as string).trim().slice(0, max) || null }
  str('display_title', 200); str('display_artist', 200); str('cover_url', 500); str('genre', 80); str('track_label', 120); str('buy_url', 500)
  if (typeof body.release_year === 'number' && body.release_year > 1900 && body.release_year < 2100) patch.release_year = Math.round(body.release_year)
  if (body.release_year === null || body.release_year === '') patch.release_year = null
  if (typeof body.published === 'boolean') patch.published = body.published

  if (Object.keys(patch).length === 0) return NextResponse.json({ ok: true })
  const { error } = await sb.from('user_submissions').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: 'Aggiornamento fallito' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
