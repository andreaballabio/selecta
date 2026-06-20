import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getFoundingConfig, setFoundingConfig, foundingCount } from '@/lib/founding-db'
import { mergeConfig, isOpen, spotsLeft, daysLeft } from '@/lib/founding'

export const dynamic = 'force-dynamic'

/** Stato + config Founding per il pannello admin. */
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied
  const sb = createAdminClient()
  try {
    const config = await getFoundingConfig(sb)
    const count = await foundingCount(sb)
    return NextResponse.json({ config, count, open: isOpen(config, count), spotsLeft: spotsLeft(config, count), daysLeft: daysLeft(config) })
  } catch {
    return NextResponse.json({ needsMigration: true })
  }
}

/** Salva la config Founding (parametri + benefici), validata. */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const config = mergeConfig(body) // sanifica deadline/cap/perks/enabled
  const sb = createAdminClient()
  try {
    await setFoundingConfig(sb, config)
    const count = await foundingCount(sb)
    return NextResponse.json({ ok: true, config, count, open: isOpen(config, count), spotsLeft: spotsLeft(config, count), daysLeft: daysLeft(config) })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
