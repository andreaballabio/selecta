import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notify'

/** Aggiunge un commento a una traccia del catalogo. Richiede login. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let submissionId = '', body = ''
  try {
    const json = await request.json()
    submissionId = typeof json.submission_id === 'string' ? json.submission_id : ''
    body = typeof json.body === 'string' ? json.body.trim() : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })
  if (body.length < 1 || body.length > 600) return NextResponse.json({ error: 'Commento non valido' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: comment, error } = await supabase
    .from('track_comments')
    .insert({ submission_id: submissionId, user_id: user.id, body })
    .select('id, body, created_at')
    .single()
  if (error || !comment) return NextResponse.json({ error: 'Commento fallito' }, { status: 500 })

  const { count } = await supabase
    .from('track_comments')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId)
  await supabase.from('user_submissions').update({ comments_count: count ?? 0 }).eq('id', submissionId)

  const { data: owner } = await supabase.from('user_submissions').select('user_id').eq('id', submissionId).maybeSingle()
  await notify(supabase, { recipient: (owner as { user_id?: string } | null)?.user_id, actor: user.id, type: 'comment', submissionId })

  // Autore (per mostrarlo subito lato client)
  const { data: prof } = await supabase
    .from('artist_profiles')
    .select('handle, display_name')
    .eq('user_id', user.id)
    .maybeSingle()

  return NextResponse.json({
    comment: {
      ...comment,
      author_handle: (prof as { handle?: string } | null)?.handle ?? null,
      author_name: (prof as { display_name?: string } | null)?.display_name ?? (user.email?.split('@')[0] ?? 'utente'),
    },
  })
}

/** Elimina un proprio commento. */
export async function DELETE(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let commentId = ''
  try {
    const json = await request.json()
    commentId = typeof json.comment_id === 'string' ? json.comment_id : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!commentId) return NextResponse.json({ error: 'comment_id required' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: row } = await supabase
    .from('track_comments')
    .select('id, submission_id, user_id')
    .eq('id', commentId)
    .maybeSingle()
  if (!row || (row as { user_id: string }).user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await supabase.from('track_comments').delete().eq('id', commentId)
  const submissionId = (row as { submission_id: string }).submission_id
  const { count } = await supabase
    .from('track_comments')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId)
  await supabase.from('user_submissions').update({ comments_count: count ?? 0 }).eq('id', submissionId)

  return NextResponse.json({ ok: true })
}
