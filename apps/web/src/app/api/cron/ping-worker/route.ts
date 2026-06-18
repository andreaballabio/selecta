import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * Tiene "sveglio" il worker su Hugging Face (gli Spaces gratuiti si addormentano
 * se inattivi → la prima analisi dopo l'idle è lenta o fallisce). Chiamato dal
 * cron Vercel ogni 10 minuti (vedi vercel.json).
 */
export async function GET() {
  const url = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'
  try {
    const r = await fetch(`${url}/health`, { signal: AbortSignal.timeout(25000) })
    return NextResponse.json({ ok: r.ok, status: r.status })
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : 'unreachable' })
  }
}
