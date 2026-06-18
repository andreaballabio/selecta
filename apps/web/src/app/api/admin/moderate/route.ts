import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

/** Moderazione (admin). Protetto dal proxy + doppio controllo qui. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let action = '', reportId = '', submissionId = ''
  try {
    const b = await request.json()
    action = b.action ?? ''; reportId = b.report_id ?? ''; submissionId = b.submission_id ?? ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const sb = createAdminClient()
  if (action === 'unpublish' && submissionId) {
    await sb.from('user_submissions').update({ published: false }).eq('id', submissionId)
    await sb.from('track_reports').update({ resolved: true }).eq('submission_id', submissionId)
    return NextResponse.json({ ok: true })
  }
  if (action === 'resolve' && reportId) {
    await sb.from('track_reports').update({ resolved: true }).eq('id', reportId)
    return NextResponse.json({ ok: true })
  }
  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
