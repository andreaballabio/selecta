import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

const WORKER_URL = process.env.WORKER_URL || 'http://localhost:8000'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
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
      .eq('user_id', user.id)
      .single()
    
    if (trackError || !track) {
      return NextResponse.json(
        { error: 'Track not found' },
        { status: 404 }
      )
    }
    
    // Get user profile for artist level
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('career_level')
      .eq('id', user.id)
      .single()
    
    const artistLevel = (profile as any)?.career_level || 'emerging'
    
    // Get public URL for the track
    const { data: publicUrlData } = supabase.storage
      .from('audio-tracks')
      .getPublicUrl(track.storage_path)
    
    // Update track status to processing
    await supabase
      .from('user_tracks')
      .update({ analysis_status: 'processing' })
      .eq('id', trackId)
    
    // Call Python worker for analysis
    const workerResponse = await fetch(`${WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: trackId,
        file_url: publicUrlData.publicUrl,
        artist_level: artistLevel,
      }),
    })
    
    if (!workerResponse.ok) {
      const errorText = await workerResponse.text()
      console.error('Worker error:', errorText)
      
      // Update track status to failed
      await supabase
        .from('user_tracks')
        .update({ 
          analysis_status: 'failed',
          analysis_error: 'Analysis service unavailable'
        })
        .eq('id', trackId)
      
      return NextResponse.json(
        { error: 'Analysis failed' },
        { status: 502 }
      )
    }
    
    const analysisResult = await workerResponse.json()
    
    // Store analysis results in database
    const { error: updateError } = await supabase
      .from('user_tracks')
      .update({
        bpm: analysisResult.features.bpm,
        key: analysisResult.features.key,
        scale: analysisResult.features.scale,
        lufs: analysisResult.features.lufs,
        duration_seconds: analysisResult.features.duration,
        audio_embedding: JSON.stringify(analysisResult.features.embedding),
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
    }
    
    // Store analysis result
    await supabase.from('analysis_results').upsert({
      track_id: trackId,
      user_id: user.id,
      ar_feedback: analysisResult.ar_feedback,
      strengths: [], // Extract from LLM response
      weaknesses: [], // Extract from LLM response
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
    
    // Delete existing matches first
    await supabase
      .from('label_matches')
      .delete()
      .eq('track_id', trackId)
    
    await supabase.from('label_matches').insert(matches)
    
    // Update user's monthly quota
    await supabase.rpc('increment_analysis_used', { user_id: user.id })
    
    return NextResponse.json({
      success: true,
      trackId,
      status: 'completed',
    })
    
  } catch (error) {
    console.error('Analysis endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
