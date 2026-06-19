import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { isValidStatus } from '@/lib/outcomes'

export const dynamic = 'force-dynamic'

const RESPONDED = new Set(['rejected', 'interested', 'signed'])

async function currentUserId(): Promise<string | null> {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  return user?.id ?? null
}

const SELECT = 'id, submission_id, label_id, label_name, status, note, sent_at, responded_at, created_at'

/** Lista degli invii dell'utente. Se la tabella non esiste ancora → lista vuota. */
export async function GET() {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const sb = createAdminClient()
  const { data, error } = await sb.from('submission_outcomes').select(SELECT)
    .eq('user_id', userId).order('created_at', { ascending: false })
  if (error) return NextResponse.json({ outcomes: [], needsMigration: true })
  return NextResponse.json({ outcomes: data ?? [] })
}

/** Registra un invio (a una label del DB o esterna). */
export async function POST(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let b: Record<string, unknown> = {}
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const label_name = typeof b.label_name === 'string' ? b.label_name.trim() : ''
  const label_id = typeof b.label_id === 'string' ? b.label_id : null
  if (!label_name && !label_id) return NextResponse.json({ error: 'label richiesta' }, { status: 400 })
  const status = isValidStatus(b.status) ? b.status : 'sent'
  const note = typeof b.note === 'string' ? b.note.slice(0, 600) : null
  const submission_id = typeof b.submission_id === 'string' ? b.submission_id : null

  const sb = createAdminClient()
  const { data, error } = await sb.from('submission_outcomes').insert({
    user_id: userId, submission_id, label_id, label_name: label_name || null,
    status, note,
    responded_at: RESPONDED.has(status) ? new Date().toISOString() : null,
  }).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, outcome: data })
}

/** Aggiorna lo stato/nota di un invio (solo i propri). */
export async function PATCH(request: NextRequest) {
  const userId = await currentUserId()
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let b: Record<string, unknown> = {}
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const id = typeof b.id === 'string' ? b.id : ''
  if (!id) return NextResponse.json({ error: 'id richiesto' }, { status: 400 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.status !== undefined) {
    if (!isValidStatus(b.status)) return NextResponse.json({ error: 'stato non valido' }, { status: 400 })
    patch.status = b.status
    if (RESPONDED.has(b.status)) patch.responded_at = new Date().toISOString()
  }
  if (typeof b.note === 'string') patch.note = b.note.slice(0, 600)

  const sb = createAdminClient()
  const { data, error } = await sb.from('submission_outcomes').update(patch)
    .eq('id', id).eq('user_id', userId).select(SELECT).maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'non trovato' }, { status: 404 })
  return NextResponse.json({ ok: true, outcome: data })
}
