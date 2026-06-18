import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

async function ownerGuard(id: string) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not authenticated' }, { status: 401 }) }
  const sb = createAdminClient()
  const { data: pl } = await sb.from('playlists').select('id, user_id').eq('id', id).maybeSingle()
  if (!pl || (pl as { user_id: string }).user_id !== user.id) return { error: NextResponse.json({ error: 'Not found' }, { status: 404 }) }
  return { sb }
}

/** Aggiunge una traccia in fondo alla playlist. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if ('error' in g) return g.error
  let submissionId = ''
  try { submissionId = (await request.json()).submission_id } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const { data: last } = await g.sb.from('playlist_tracks').select('position').eq('playlist_id', id).order('position', { ascending: false }).limit(1).maybeSingle()
  const position = ((last as { position?: number } | null)?.position ?? -1) + 1
  const { error } = await g.sb.from('playlist_tracks').upsert({ playlist_id: id, submission_id: submissionId, position }, { onConflict: 'playlist_id,submission_id' })
  if (error) return NextResponse.json({ error: 'Aggiunta fallita' }, { status: 500 })
  await g.sb.from('playlists').update({ updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: true })
}

/** Rimuove una traccia dalla playlist. */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if ('error' in g) return g.error
  let submissionId = ''
  try { submissionId = (await request.json()).submission_id } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })
  await g.sb.from('playlist_tracks').delete().eq('playlist_id', id).eq('submission_id', submissionId)
  return NextResponse.json({ ok: true })
}
