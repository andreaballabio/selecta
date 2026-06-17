import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/**
 * Toggle "Salva" (crate del DJ) su una traccia. Richiede login.
 * È il segnale "questa la suonerei" — il precursore del download (Fase 2).
 * saves_count denormalizzato e ricalcolato a ogni toggle.
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let submissionId = ''
  try {
    const body = await request.json()
    submissionId = typeof body.submission_id === 'string' ? body.submission_id : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: existing } = await supabase
    .from('track_saves')
    .select('id')
    .eq('submission_id', submissionId)
    .eq('user_id', user.id)
    .maybeSingle()

  let saved: boolean
  if (existing) {
    await supabase.from('track_saves').delete().eq('id', existing.id)
    saved = false
  } else {
    const { error } = await supabase.from('track_saves').insert({ submission_id: submissionId, user_id: user.id })
    if (error) return NextResponse.json({ error: 'Save failed' }, { status: 500 })
    saved = true
  }

  const { count } = await supabase
    .from('track_saves')
    .select('id', { count: 'exact', head: true })
    .eq('submission_id', submissionId)
  const savesCount = count ?? 0
  await supabase.from('user_submissions').update({ saves_count: savesCount }).eq('id', submissionId)

  return NextResponse.json({ saved, saves_count: savesCount })
}
