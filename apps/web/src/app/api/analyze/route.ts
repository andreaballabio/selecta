import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // TEMP: Bypass authentication for testing
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
    
    // MOCK ANALYSIS - No external worker needed
    const mockFeatures = {
      bpm: 124.5,
      key: 'A',
      scale: 'minor',
      lufs: -14.2,
      energy_curve: Array(100).fill(0.5),
      duration: 240.0,
      spectral_centroid_mean: 2500.0,
      spectral_rolloff_mean: 6000.0,
      zero_crossing_rate_mean: 0.05,
      embedding: Array(128).fill(0.0)
    }
    
    const mockMatches = [
      {
        label_id: 'solid-grooves',
        label_name: 'Solid Grooves Records',
        sound_match_score: 85.0,
        accessibility_score: 70.0,
        trend_score: 75.0,
        final_probability: 78.0,
        reasoning: 'Great match for Solid Grooves sound - your track has the groovy bassline and rolling percussion that defines their catalogue.'
      },
      {
        label_id: 'hot-creations',
        label_name: 'Hot Creations',
        sound_match_score: 72.0,
        accessibility_score: 85.0,
        trend_score: 80.0,
        final_probability: 68.0,
        reasoning: 'Good accessibility match. Your track has commercial appeal while maintaining underground credibility.'
      },
      {
        label_id: 'black-book',
        label_name: 'Black Book Records',
        sound_match_score: 65.0,
        accessibility_score: 60.0,
        trend_score: 70.0,
        final_probability: 58.0,
        reasoning: 'Solid underground match. Your sound aligns with their darker, more experimental releases.'
      }
    ]
    
    // Update track with analysis results
    await (supabase as any)
      .from('user_tracks')
      .update({
        bpm: mockFeatures.bpm,
        key: mockFeatures.key,
        scale: mockFeatures.scale,
        lufs: mockFeatures.lufs,
        duration_seconds: mockFeatures.duration,
        audio_embedding: JSON.stringify(mockFeatures.embedding),
        energy_curve: mockFeatures.energy_curve,
        features: {
          spectral_centroid: mockFeatures.spectral_centroid_mean,
          spectral_rolloff: mockFeatures.spectral_rolloff_mean,
          zcr: mockFeatures.zero_crossing_rate_mean,
        },
        analysis_status: 'completed',
        analyzed_at: new Date().toISOString(),
      })
      .eq('id', trackId)
    
    // Store analysis result
    await (supabase as any).from('analysis_results').upsert({
      track_id: trackId,
      user_id: userId,
      ar_feedback: 'This track shows strong potential with solid groove and energy. The bassline work is particularly effective, creating that rolling tech house feel that works well on dancefloors. Consider slightly more dynamic range in the breakdown to create more tension before the drop.',
      strengths: ['Strong groove', 'Good energy', 'Effective bassline'],
      weaknesses: ['Could use more dynamic range'],
    }, { onConflict: 'track_id' })
    
    // Store label matches
    const matches = mockMatches.map((match: any, index: number) => ({
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
