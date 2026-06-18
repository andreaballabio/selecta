import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { drainQueue } from '@/lib/analyze-track'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

/**
 * Drain "client-driven": chiamato dall'indicatore in navbar mentre un tab admin
 * è aperto → fa avanzare la coda GLOBALE (tutte le label, round-robin) anche
 * senza dipendere dal cron Vercel. Protetto dal gate admin del proxy.
 * Lotto piccolo + tetto di tempo per stare sotto il maxDuration della function.
 */
export async function POST() {
  try {
    const res = await drainQueue(supabase, 4, 40000)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ ok: false, processed: 0, error: e instanceof Error ? e.message : 'drain failed' }, { status: 500 })
  }
}
