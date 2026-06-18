import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notify'

/** Toggle del follow di un artista. Richiede login. Non ci si segue da soli. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let targetId = ''
  try {
    const body = await request.json()
    targetId = typeof body.target_user_id === 'string' ? body.target_user_id : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!targetId) return NextResponse.json({ error: 'target_user_id required' }, { status: 400 })
  if (targetId === user.id) return NextResponse.json({ error: 'Non puoi seguire te stesso' }, { status: 400 })

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('follows')
    .select('follower_id')
    .eq('follower_id', user.id)
    .eq('following_id', targetId)
    .maybeSingle()

  let following: boolean
  if (existing) {
    await supabase.from('follows').delete().eq('follower_id', user.id).eq('following_id', targetId)
    following = false
  } else {
    const { error } = await supabase.from('follows').insert({ follower_id: user.id, following_id: targetId })
    if (error) return NextResponse.json({ error: 'Follow failed' }, { status: 500 })
    following = true
    await notify(supabase, { recipient: targetId, actor: user.id, type: 'follow' })
  }

  const { count } = await supabase
    .from('follows')
    .select('follower_id', { count: 'exact', head: true })
    .eq('following_id', targetId)

  return NextResponse.json({ following, followers_count: count ?? 0 })
}
