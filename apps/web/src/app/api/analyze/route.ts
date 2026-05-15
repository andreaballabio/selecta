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
    
    // Call Python worker for analysis
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
    console.log('Worker response:', JSON.stringify(analysisResult, null, 2))
    
    // Extract features from worker response
    const features = analysisResult.features || {}
    
    // Update track with analysis results
    const { error: updateError } = await (supabase as any)
      .from('user_tracks')
      .update({
        bpm: features.bpm || 124.5,
        key: features.key || 'A',
        scale: features.scale || 'minor',
        lufs: features.lufs || -14.2,
        duration_seconds: features.duration || 240.0,
        energy_curve: features.energy_curve || [0.5] * 10,
        features: {
          spectral_centroid: features.spectral_centroid || 2500.0,
          spectral_rolloff: features.spectral_rolloff || 6000.0,
          zcr: features.zero_crossing_rate || 0.05,
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
      ar_feedback: analysisResult.ar_feedback || 'Analysis completed successfully.',
      strengths: [],
      weaknesses: [],
    }, { onConflict: 'track_id' })
    
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
