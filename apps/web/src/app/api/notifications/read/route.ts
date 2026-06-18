import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/** Segna tutte le notifiche dell'utente come lette. */
export async function POST() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const sb = createAdminClient()
  await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('recipient_id', user.id).is('read_at', null)
  return NextResponse.json({ ok: true })
}
