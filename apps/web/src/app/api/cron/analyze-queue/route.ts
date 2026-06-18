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
  const isVercelCron = ua.includes('vercel-cron')
  const hasSecret = !!secret && auth === `Bearer ${secret}`
  if (!isVercelCron && !hasSecret) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
  )

  // Lotto piccolo: il worker HF processa ~1 traccia alla volta; restiamo sotto
  // maxDuration e sotto l'intervallo del cron così due run non si accavallano.
  const BATCH = Number(process.env.ANALYZE_BATCH ?? 4)

  try {
    const res = await drainQueue(supabase, BATCH)
    return NextResponse.json({ ok: true, ...res })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'drain failed' }, { status: 500 })
  }
}
