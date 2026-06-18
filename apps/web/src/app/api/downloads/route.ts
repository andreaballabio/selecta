import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { getSubscription, canDownload } from '@/lib/subscription'

/**
 * Download di una traccia/versione. Gated dall'abbonamento DJ Pool (SIMULATO).
 * Ritorna l'URL del file + nome; registra la cronologia. Senza abbonamento → 402.
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const sub = await getSubscription(user.id)
  if (!canDownload(sub)) return NextResponse.json({ error: 'Serve il DJ Pool', paywall: true }, { status: 402 })

  let submissionId = '', versionId: string | null = null
  try {
    const b = await request.json()
    submissionId = typeof b.submission_id === 'string' ? b.submission_id : ''
    versionId = typeof b.version_id === 'string' ? b.version_id : null
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: track } = await sb.from('user_submissions').select('display_title, display_artist, file_url, published').eq('id', submissionId).maybeSingle()
  if (!track || !(track as { published?: boolean }).published) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const t = track as { display_title: string | null; display_artist: string | null; file_url: string | null }

  let url = t.file_url
  let label: string | null = null
  if (versionId) {
    const { data: v } = await sb.from('track_versions').select('file_url, label, submission_id').eq('id', versionId).maybeSingle()
    if (v && (v as { submission_id: string }).submission_id === submissionId) { url = (v as { file_url: string }).file_url; label = (v as { label: string }).label }
  }
  if (!url) return NextResponse.json({ error: 'File non disponibile' }, { status: 404 })

  await sb.from('downloads').insert({ user_id: user.id, submission_id: submissionId, version_id: versionId, label })

  const base = `${(t.display_artist ? t.display_artist + ' - ' : '')}${t.display_title ?? 'track'}${label ? ' (' + label + ')' : ''}`.replace(/[^\w\s().-]/g, '').trim()
  return NextResponse.json({ url, filename: `${base || 'track'}.mp3` })
}
