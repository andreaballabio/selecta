import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

async function me() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  return user
}

/** Aggiunge una versione (file audio) a una propria traccia. */
export async function POST(request: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let submissionId = '', label = '', fileUrl = ''
  try {
    const b = await request.json()
    submissionId = typeof b.submission_id === 'string' ? b.submission_id : ''
    label = typeof b.label === 'string' ? b.label.trim().slice(0, 60) : ''
    fileUrl = typeof b.file_url === 'string' ? b.file_url.trim() : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId || !label || !fileUrl) return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })

  const sb = createAdminClient()
  const { data: sub } = await sb.from('user_submissions').select('user_id').eq('id', submissionId).maybeSingle()
  if (!sub || (sub as { user_id: string }).user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: last } = await sb.from('track_versions').select('position').eq('submission_id', submissionId).order('position', { ascending: false }).limit(1).maybeSingle()
  const position = ((last as { position?: number } | null)?.position ?? -1) + 1
  const { data: version, error } = await sb.from('track_versions').insert({ submission_id: submissionId, label, file_url: fileUrl, position }).select('id, label, file_url').single()
  if (error || !version) return NextResponse.json({ error: 'Aggiunta fallita' }, { status: 500 })
  return NextResponse.json({ version })
}

/** Rimuove una propria versione. */
export async function DELETE(request: NextRequest) {
  const user = await me()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let versionId = ''
  try { versionId = (await request.json()).version_id } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!versionId) return NextResponse.json({ error: 'version_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: v } = await sb.from('track_versions').select('id, submission_id').eq('id', versionId).maybeSingle()
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const { data: sub } = await sb.from('user_submissions').select('user_id').eq('id', (v as { submission_id: string }).submission_id).maybeSingle()
  if (!sub || (sub as { user_id: string }).user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await sb.from('track_versions').delete().eq('id', versionId)
  return NextResponse.json({ ok: true })
}
