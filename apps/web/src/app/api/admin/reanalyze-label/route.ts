import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
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
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const { label_id } = await request.json()
    if (!label_id) {
      return NextResponse.json({ error: 'label_id richiesto' }, { status: 400 })
    }

    // Fetch all matched tracks for this label
    const { data: tracks, error } = await supabase
      .from('label_ingestion_queue')
      .select('id, spotify_preview_url, audio_preview_url, spotify_track_id')
      .eq('label_id', label_id)
      .eq('status', 'matched')

    if (error) throw error

    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ success: true, reset: 0, message: 'Nessuna traccia matched' })
    }

    // Reset tutte le tracce matched a 'pending' — anche quelle senza URL,
    // perché analyzeSingleTrack ora tenta il refresh automatico via track_id
    const { error: updateError } = await supabase
      .from('label_ingestion_queue')
      .update({ analysis_status: 'pending', analysis_error: null })
      .in('id', tracks.map((t) => t.id))

    if (updateError) throw updateError

    const withUrl = tracks.filter((t) => t.spotify_preview_url || t.audio_preview_url).length
    const withTrackId = tracks.filter((t) => !t.spotify_preview_url && !t.audio_preview_url && t.spotify_track_id).length
    const noInfo = tracks.length - withUrl - withTrackId

    return NextResponse.json({
      success: true,
      reset: tracks.length,
      with_url: withUrl,
      will_refresh: withTrackId,
      no_info: noInfo,
    })
  } catch (err: any) {
    console.error('[reanalyze-label]', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
