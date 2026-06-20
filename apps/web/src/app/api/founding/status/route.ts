import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { getFoundingConfig, foundingCount, ensureFounding } from '@/lib/founding-db'
import { isOpen, spotsLeft, daysLeft, activePerks } from '@/lib/founding'

export const dynamic = 'force-dynamic'

/**
 * Stato Founding per la UI + ASSEGNAZIONE automatica: se l'utente è loggato e la
 * finestra è aperta (entro data e sotto tetto), diventa Founding qui. Idempotente.
 */
export async function GET() {
  const sb = createAdminClient()
  let config, count: number
  try {
    config = await getFoundingConfig(sb)
    count = await foundingCount(sb)
  } catch {
    return NextResponse.json({ enabled: false }) // migration 0018 non ancora eseguita
  }

  let meFounding = false
  try {
    const ssr = await createSsrClient()
    const { data: { user } } = await ssr.auth.getUser()
    if (user) meFounding = await ensureFounding(sb, user.id)
  } catch { /* anonimo */ }

  return NextResponse.json({
    enabled: config.enabled,
    open: isOpen(config, count),
    count,
    cap: config.cap,
    spotsLeft: spotsLeft(config, count),
    daysLeft: daysLeft(config),
    perks: activePerks(config),
    me: { founding: meFounding },
  })
}
