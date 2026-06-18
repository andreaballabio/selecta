import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/** Crea una playlist. Richiede login. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let title = '', isPublic = true
  try {
    const b = await request.json()
    title = typeof b.title === 'string' ? b.title.trim() : ''
    if (typeof b.is_public === 'boolean') isPublic = b.is_public
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (title.length < 1 || title.length > 120) return NextResponse.json({ error: 'Titolo non valido' }, { status: 400 })

  const sb = createAdminClient()
  const { data, error } = await sb.from('playlists').insert({ user_id: user.id, title, is_public: isPublic }).select('id, title, is_public').single()
  if (error || !data) return NextResponse.json({ error: 'Creazione fallita' }, { status: 500 })
  return NextResponse.json({ playlist: data })
}
