import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'

const VALID_TIERS = ['producer-pro', 'dj-pool', 'label']

/**
 * Billing SIMULATO (provider 'fake'). Attiva/cancella l'abbonamento senza alcun
 * pagamento reale. In futuro questa route sarà sostituita da un checkout Stripe.
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  let action = '', tier = ''
  try {
    const b = await request.json()
    action = typeof b.action === 'string' ? b.action : ''
    tier = typeof b.tier === 'string' ? b.tier : ''
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const sb = createAdminClient()

  if (action === 'cancel') {
    await sb.from('subscriptions').update({ status: 'canceled', updated_at: new Date().toISOString() }).eq('user_id', user.id)
    return NextResponse.json({ ok: true, status: 'canceled' })
  }

  if (action === 'subscribe') {
    if (!VALID_TIERS.includes(tier)) return NextResponse.json({ error: 'Tier non valido' }, { status: 400 })
    // Simulato: 30 giorni, provider 'fake'.
    const expires = new Date(Date.now() + 30 * 24 * 3.6e6).toISOString()
    const { error } = await sb.from('subscriptions').upsert({
      user_id: user.id, tier, status: 'active', provider: 'fake', activated_at: new Date().toISOString(), expires_at: expires, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) return NextResponse.json({ error: 'Attivazione fallita' }, { status: 500 })
    return NextResponse.json({ ok: true, status: 'active', tier })
  }

  return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
}
