import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildTrackReport, type ReportFeatures } from '@/lib/report'

interface MatchRow { label_name?: string; score?: number }

/**
 * Demo Score: punteggio 0-100 della traccia (readiness tecnica + quanto "suona
 * firmabile") + PERCENTILE rispetto alle altre demo analizzate. Solo dati reali:
 * readiness da buildTrackReport, fit da match_results. Niente numeri inventati.
 */
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('submission_id') ?? ''
  if (!id) return NextResponse.json({ error: 'submission_id required' }, { status: 400 })

  const sb = createAdminClient()
  const { data: sub } = await sb.from('user_submissions')
    .select('bpm, key, scale, lufs, duration, energy, spectral_centroid, spectral_rolloff, zero_crossing_rate, onset_strength, sub_ratio, mid_presence, tempo_stability, spectral_contrast, match_results')
    .eq('id', id).maybeSingle()
  if (!sub) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const features = sub as ReportFeatures & { match_results: MatchRow[] | null }
  const readiness = buildTrackReport(features).readiness.score // 0-100 (tecnico)
  const topMatch = features.match_results?.[0]?.score ?? 0       // 0-1 (fit sound label)
  const topLabel = features.match_results?.[0]?.label_name ?? null
  const fitPct = Math.round(topMatch * 100)
  const demoScore = Math.round(0.5 * readiness + 0.5 * fitPct)

  // Percentile vs corpus: distribuzione del "fit" (top match) fra le demo analizzate.
  const { data: corpus } = await sb.from('user_submissions')
    .select('match_results').eq('analysis_status', 'analyzed').limit(5000)
  const tops = ((corpus ?? []) as { match_results: MatchRow[] | null }[])
    .map((r) => r.match_results?.[0]?.score ?? 0)
    .filter((s) => s > 0)
  const sampleSize = tops.length
  const below = tops.filter((s) => s < topMatch).length
  const percentile = sampleSize > 1 ? Math.round((below / sampleSize) * 100) : null

  return NextResponse.json({ demoScore, readiness, fit: fitPct, topLabel, percentile, sampleSize, small: sampleSize < 20 })
}
