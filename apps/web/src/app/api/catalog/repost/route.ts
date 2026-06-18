import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { notify } from '@/lib/notify'

/** Toggle del repost (ricondividi ai follower). Richiede login. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let submissionId = ''
  try { submissionId = (await request.json()).submission_id } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: existing } = await sb.from('reposts').select('id').eq('submission_id', submissionId).eq('user_id', user.id).maybeSingle()

  let reposted: boolean
  if (existing) {
    await sb.from('reposts').delete().eq('id', (existing as { id: string }).id)
    reposted = false
  } else {
    const { error } = await sb.from('reposts').insert({ submission_id: submissionId, user_id: user.id })
    if (error) return NextResponse.json({ error: 'Repost failed' }, { status: 500 })
    reposted = true
    const { data: sub } = await sb.from('user_submissions').select('user_id').eq('id', submissionId).maybeSingle()
    await notify(sb, { recipient: (sub as { user_id?: string } | null)?.user_id, actor: user.id, type: 'repost', submissionId })
  }

  const { count } = await sb.from('reposts').select('id', { count: 'exact', head: true }).eq('submission_id', submissionId)
  const repostsCount = count ?? 0
  await sb.from('user_submissions').update({ reposts_count: repostsCount }).eq('id', submissionId)

  return NextResponse.json({ reposted, reposts_count: repostsCount })
}
