import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  )

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .select(`
      analysis_status, match_results,
      bpm, key, scale, energy, lufs, duration,
      spectral_centroid, spectral_rolloff, zero_crossing_rate,
      onset_strength, sub_ratio, mid_presence, tempo_stability, spectral_contrast
    `)
    .eq('id', id)
    .single()

  if (error || !submission) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }

  return NextResponse.json({
    status: submission.analysis_status,
    match_results: submission.match_results ?? null,
    features: {
      bpm: submission.bpm,
      key: submission.key,
      scale: submission.scale,
      energy: submission.energy,
      lufs: submission.lufs,
      duration: submission.duration,
      spectral_centroid: submission.spectral_centroid,
      spectral_rolloff: submission.spectral_rolloff,
      zero_crossing_rate: submission.zero_crossing_rate,
      onset_strength: submission.onset_strength,
      sub_ratio: submission.sub_ratio,
      mid_presence: submission.mid_presence,
      tempo_stability: submission.tempo_stability,
      spectral_contrast: submission.spectral_contrast,
    },
  })
}
