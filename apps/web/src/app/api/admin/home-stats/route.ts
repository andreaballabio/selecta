import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { getHomeStatsConfig, setHomeStatsConfig, getRealStats } from '@/lib/home-stats-db'
import { mergeHomeStats } from '@/lib/home-stats'

export const dynamic = 'force-dynamic'

/** Config + conteggi reali per il pannello admin. */
export async function GET() {
  const denied = await requireAdminApi(); if (denied) return denied
  const sb = createAdminClient()
  try {
    const [config, real] = await Promise.all([getHomeStatsConfig(sb), getRealStats(sb)])
    return NextResponse.json({ config, real })
  } catch {
    return NextResponse.json({ needsMigration: true })
  }
}

/** Salva la config (manuale + soglia per metrica), sanificata. */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const config = mergeHomeStats(body)
  const sb = createAdminClient()
  try {
    await setHomeStatsConfig(sb, config)
    const real = await getRealStats(sb)
    return NextResponse.json({ ok: true, config, real })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
