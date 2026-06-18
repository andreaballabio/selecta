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
  return { sb, user }
}

/** Aggiorna titolo / descrizione / visibilità. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if ('error' in g) return g.error
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.title === 'string' && body.title.trim()) patch.title = body.title.trim().slice(0, 120)
  if (typeof body.description === 'string') patch.description = body.description.slice(0, 1000)
  if (typeof body.is_public === 'boolean') patch.is_public = body.is_public
  if (typeof body.cover_url === 'string') patch.cover_url = body.cover_url.trim() || null
  await g.sb.from('playlists').update(patch).eq('id', id)
  return NextResponse.json({ ok: true })
}

/** Elimina la playlist. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const g = await ownerGuard(id)
  if ('error' in g) return g.error
  await g.sb.from('playlists').delete().eq('id', id)
  return NextResponse.json({ ok: true })
}
