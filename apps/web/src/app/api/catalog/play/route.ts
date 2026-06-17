import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * Incrementa il play count di una traccia. NON richiede login (ascolto anonimo).
 * Best-effort, read-modify-write: a questa scala l'accuratezza esatta non serve.
 */
export async function POST(request: NextRequest) {
  let submissionId = ''
  try {
    const body = await request.json()
    submissionId = typeof body.submission_id === 'string' ? body.submission_id : ''
  } catch { return NextResponse.json({ ok: false }, { status: 400 }) }
  if (!submissionId) return NextResponse.json({ ok: false }, { status: 400 })

  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_submissions')
    .select('play_count, published')
    .eq('id', submissionId)
    .maybeSingle()

  // Conta solo per tracce pubblicate.
  if (!data || !(data as { published?: boolean }).published) return NextResponse.json({ ok: false })

  const next = ((data as { play_count?: number }).play_count ?? 0) + 1
  await supabase.from('user_submissions').update({ play_count: next }).eq('id', submissionId)
  return NextResponse.json({ ok: true, play_count: next })
}
