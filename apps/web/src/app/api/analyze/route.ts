import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8080'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const userId = '00000000-0000-0000-0000-000000000001'
    
    const body = await request.json()
    const { trackId } = body
    
    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID required' },
        { status: 400 }
      )
    }
    
    // Get track details
    const { data: track, error: trackError } = await supabase
      .from('user_tracks')
      .select('*')
      .eq('id', trackId)
      .single()
    
    if (trackError || !track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }
    
    // Get public URL for the track
    const { data: publicUrlData } = supabase.storage
      .from('audio-tracks')
      .getPublicUrl(track.storage_path)
    
    console.log('Calling worker at:', `${WORKER_URL}/analyze`)
    console.log('Track URL:', publicUrlData.publicUrl)
    
    // Call Python worker for REAL analysis
    const workerResponse = await fetch(`${WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: trackId,
        file_url: publicUrlData.publicUrl,
        artist_level: 'emerging',
      }),
    })
    
    if (!workerResponse.ok) {
      const errorText = await workerResponse.text()
      console.error('Worker error:', errorText)
      throw new Error(`Worker failed: ${errorText}`)
    }
    
    const analysisResult = await workerResponse.json()
    console.log('Worker response received')
    
    // Update track with REAL analysis results
    const { error: updateError } = await (supabase as any)
      .from('user_tracks')
      .update({
        bpm: analysisResult.features.bpm,
        key: analysisResult.features.key,
        scale: analysisResult.features.scale,
        lufs: analysisResult.features.lufs,
        duration_seconds: analysisResult.features.duration,
        energy_curve: analysisResult.features.energy_curve,
        features: {
          spectral_centroid: analysisResult.features.spectral_centroid_mean,
          spectral_rolloff: analysisResult.features.spectral_rolloff_mean,
          zcr: analysisResult.features.zero_crossing_rate_mean,
        },
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', trackId)
    
    if (updateError) {
      console.error('Update track error:', updateError)
      throw new Error(`Failed to update track: ${updateError.message}`)
    }
    
    // Store analysis result
    await (supabase as any).from('analysis_results').upsert({
      track_id: trackId,
      user_id: userId,
      ar_feedback: analysisResult.ar_feedback,
      strengths: analysisResult.improvement_suggestions || [],
      weaknesses: [],
    }, { onConflict: 'track_id' })
    
    // Store label matches
    const matches = analysisResult.top_matches.map((match: any, index: number) => ({
      track_id: trackId,
      label_id: match.label_id,
      sound_match_score: match.sound_match_score,
      accessibility_score: match.accessibility_score,
      trend_alignment_score: match.trend_score,
      final_probability: match.final_probability,
      match_reasoning: match.reasoning,
      rank: index + 1,
    }))
    
    await (supabase as any)
      .from('label_matches')
      .delete()
      .eq('track_id', trackId)
    
    await (supabase as any).from('label_matches').insert(matches)
    
    return NextResponse.json({
      success: true,
      trackId,
      status: 'completed',
    })
    
  } catch (error: any) {
    console.error('Analysis endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    )
  }
}
