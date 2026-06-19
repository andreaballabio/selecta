import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { drainQueue } from '@/lib/analyze-track'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * Cron di background: analizza un piccolo lotto di tracce pending della coda
 * GLOBALE (tutte le label) a ogni invocazione. Girando dal cron Vercel
 * (vedi vercel.json), l'analisi prosegue da sola — anche a computer spento.
 *
 * Auth: la richiesta del cron Vercel arriva con UA "vercel-cron" (e, se
 * CRON_SECRET è impostato, con Authorization: Bearer <CRON_SECRET>).
 */
export async function GET(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  // Se CRON_SECRET è impostato lo ESIGIAMO (Vercel lo invia in automatico come
  // Bearer): l'User-Agent da solo è falsificabile. Senza secret, fallback sull'UA
  // del cron Vercel così la pianificazione continua a funzionare comunque.
  const allowed = secret ? auth === `Bearer ${secret}` : ua.includes('vercel-cron')
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
  )

  // Throughput limitato dal worker (~1 traccia alla volta). Alziamo il tetto di
  // tracce per run, ma il TEMPO massimo (maxMs) garantisce che ogni esecuzione
  // finisca ben sotto l'intervallo del cron (2 min) → niente sovrapposizioni.
  const BATCH = Number(process.env.ANALYZE_BATCH ?? 8)
  const MAX_MS = Number(process.env.ANALYZE_MAX_MS ?? 80000)

  try {
    const res = await drainQueue(supabase, BATCH, MAX_MS)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'drain failed' }, { status: 500 })
  }
}
