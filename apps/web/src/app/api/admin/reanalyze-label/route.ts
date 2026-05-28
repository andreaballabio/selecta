import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

/**
 * POST /api/admin/reanalyze-label
 * Body: { label_id: string }
 *
 * Resets analysis_status → 'pending' for all matched tracks that still have
 * a preview URL (spotify_preview_url or audio_preview_url).
 * Tracks with no URL are reported as skipped — they need manual re-matching.
 */
export async function POST(request: NextRequest) {
  try {
    const { label_id } = await request.json()
    if (!label_id) {
      return NextResponse.json({ error: 'label_id richiesto' }, { status: 400 })
    }

    // Fetch all matched tracks for this label
    const { data: tracks, error } = await supabase
      .from('label_ingestion_queue')
      .select('id, spotify_preview_url, audio_preview_url, analysis_status')
      .eq('label_id', label_id)
      .eq('status', 'matched')

    if (error) throw error

    const withUrl = (tracks ?? []).filter(
      (t) => t.spotify_preview_url || t.audio_preview_url
    )
    const noUrl = (tracks ?? []).filter(
      (t) => !t.spotify_preview_url && !t.audio_preview_url
    )

    if (withUrl.length === 0) {
      return NextResponse.json({
        success: true,
        reset: 0,
        no_url: noUrl.length,
        message: 'Nessuna traccia con URL disponibile da ri-analizzare',
      })
    }

    // Reset to 'pending' so the existing analysis loop picks them up
    const { error: updateError } = await supabase
      .from('label_ingestion_queue')
      .update({ analysis_status: 'pending', analysis_error: null })
      .in('id', withUrl.map((t) => t.id))

    if (updateError) throw updateError

    return NextResponse.json({
      success: true,
      reset: withUrl.length,
      no_url: noUrl.length,
    })
  } catch (err: any) {
    console.error('[reanalyze-label]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
