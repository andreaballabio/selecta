import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

const REASONS = ['copyright', 'non originale', 'contenuto offensivo', 'spam', 'altro']

/** Segnala una traccia. Aperta a tutti (reporter_id se loggato). */
export async function POST(request: NextRequest) {
  let submissionId = '', reason = '', details = ''
  try {
    const b = await request.json()
    submissionId = typeof b.submission_id === 'string' ? b.submission_id : ''
    reason = typeof b.reason === 'string' ? b.reason : ''
    details = typeof b.details === 'string' ? b.details.slice(0, 1000) : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!submissionId || !REASONS.includes(reason)) return NextResponse.json({ error: 'Dati non validi' }, { status: 400 })

  let reporterId: string | null = null
  try { const ssr = await createSsrClient(); reporterId = (await ssr.auth.getUser()).data.user?.id ?? null } catch { /* anonimo */ }

  const sb = createAdminClient()
  const { error } = await sb.from('track_reports').insert({ submission_id: submissionId, reporter_id: reporterId, reason, details: details || null })
  if (error) return NextResponse.json({ error: 'Segnalazione fallita' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
