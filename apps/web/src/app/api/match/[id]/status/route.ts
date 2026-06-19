import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const BASE =
  'analysis_status, match_results, bpm, key, scale, energy, lufs, duration, ' +
  'spectral_centroid, spectral_rolloff, zero_crossing_rate, onset_strength, ' +
  'sub_ratio, mid_presence, tempo_stability, spectral_contrast'
// Check tecnici "da A&R" (migrazione 0016). Se le colonne non esistono ancora,
// si ricade sul set base → nessuna regressione.
const EXTRA = 'true_peak_dbtp, crest_db, stereo_correlation, loopiness, intro_build'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  )

  const sel = (cols: string) => supabase.from('user_submissions').select(cols).eq('id', id).single()
  let res = await sel(`${BASE}, ${EXTRA}`)
  if (res.error) res = await sel(BASE)
  if (res.error || !res.data) {
    return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
  }
  const s = res.data as unknown as Record<string, unknown>
  const num = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) : null)

  return NextResponse.json({
    status: s.analysis_status,
    match_results: s.match_results ?? null,
    features: {
      bpm: num('bpm'), key: s.key ?? null, scale: s.scale ?? null,
      energy: num('energy'), lufs: num('lufs'), duration: num('duration'),
      spectral_centroid: num('spectral_centroid'), spectral_rolloff: num('spectral_rolloff'),
      zero_crossing_rate: num('zero_crossing_rate'), onset_strength: num('onset_strength'),
      sub_ratio: num('sub_ratio'), mid_presence: num('mid_presence'),
      tempo_stability: num('tempo_stability'), spectral_contrast: num('spectral_contrast'),
      // Pre-flight A&R (null finché non rianalizzato col worker v2)
      true_peak_dbtp: num('true_peak_dbtp'), crest_db: num('crest_db'),
      stereo_correlation: num('stereo_correlation'), loopiness: num('loopiness'), intro_build: num('intro_build'),
    },
  })
}
