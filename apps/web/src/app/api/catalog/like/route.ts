import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/**
 * Toggle del like su una traccia del catalogo. Richiede login.
 * Il conteggio (likes_count) è denormalizzato su user_submissions e ricalcolato
 * via service role a ogni toggle (scala piccola → conteggio esatto, niente drift).
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let submissionId = ''
  try {
    const body = await request.json()
    submissionId = typeof body.submission_id === 'string' ? body.submission_id : ''
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }
  if (!submissionId) {
    return NextResponse.json({ error: 'submission_id required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )

  // Esiste già il like?
  const { data: existing } = await supabase
    .from('track_likes')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('user_id', user.id)
    .maybeSingle()

  let liked: boolean
  if (existing) {
    await supabase.from('track_likes').delete().eq('id', existing.id)
    liked = false
  } else {
    const { error } = await supabase.from('track_likes')
      .insert({ submission_id: submissionId, user_id: user.id })
    if (error) {
      console.error('[catalog/like] insert error:', error)
      return NextResponse.json({ error: 'Like fallito' }, { status: 500 })
    }
    liked = true
  }

  // Ricalcola il conteggio esatto e denormalizza.
  const { count } = await supabase
    .from('track_likes')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId)

  const likesCount = count ?? 0
  await supabase.from('user_submissions')
    .update({ likes_count: likesCount })
    .eq('id', submissionId)

  return NextResponse.json({ liked, likes_count: likesCount })
}
