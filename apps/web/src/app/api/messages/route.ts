import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/** Invia un messaggio diretto. Richiede login. Genera una notifica al destinatario. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let recipientId = '', body = ''
  try {
    const j = await request.json()
    recipientId = typeof j.recipient_id === 'string' ? j.recipient_id : ''
    body = typeof j.body === 'string' ? j.body.trim() : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  if (!recipientId || recipientId === user.id) return NextResponse.json({ error: 'Destinatario non valido' }, { status: 400 })
  if (body.length < 1 || body.length > 2000) return NextResponse.json({ error: 'Messaggio non valido' }, { status: 400 })

  const sb = createAdminClient()
  const { data: msg, error } = await sb.from('messages')
    .insert({ sender_id: user.id, recipient_id: recipientId, body })
    .select('id, body, created_at, sender_id, recipient_id')
    .single()
  if (error || !msg) return NextResponse.json({ error: 'Invio fallito' }, { status: 500 })

  await sb.from('notifications').insert({ recipient_id: recipientId, actor_id: user.id, type: 'message' }).then(() => {}, () => {})

  return NextResponse.json({ message: msg })
}
