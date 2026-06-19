import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { runLabelIntelligence } from '@/lib/label-intelligence-job'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

/** Ricalcolo notturno automatico della Label Intelligence (famiglie, pesi,
 *  affidabilità) + snapshot storico. Auth come gli altri cron. */
export async function GET(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  const allowed = secret ? auth === `Bearer ${secret}` : ua.includes('vercel-cron')
  if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )
  try {
    const summary = await runLabelIntelligence(sb)
    return NextResponse.json({ ok: true, ...summary })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'error' }, { status: 500 })
  }
}
