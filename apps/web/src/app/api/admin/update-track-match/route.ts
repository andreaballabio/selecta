import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { 
      track_id, 
      spotify_track_id,
      spotify_track_name,
      spotify_artist_name,
      spotify_url,
      spotify_album_name,
      spotify_album_image,
      spotify_preview_url,
      spotify_duration_ms,
      spotify_popularity,
      notes 
    } = body
    
    if (!track_id || !spotify_track_id) {
      return NextResponse.json(
        { error: 'Track ID e Spotify Track ID richiesti' },
        { status: 400 }
      )
    }
    
    // Recupera vecchi dati per history
    const { data: oldTrack } = await supabase
      .from('label_ingestion_queue')
      .select('spotify_track_id, spotify_track_name, spotify_match_confidence')
      .eq('id', track_id)
      .single()
    
    // Salva nella history
    await supabase
      .from('track_match_history')
      .insert({
        track_id,
        old_spotify_track_id: oldTrack?.spotify_track_id,
        old_spotify_track_name: oldTrack?.spotify_track_name,
        old_confidence: oldTrack?.spotify_match_confidence,
        new_spotify_track_id: spotify_track_id,
        new_spotify_track_name: spotify_track_name,
        new_confidence: 0.95, // Match manuale = alta confidence
        change_reason: 'manual_correction',
        notes: notes || 'Correzione manuale'
      })
    
    // Aggiorna la traccia
    const { error } = await supabase
      .from('label_ingestion_queue')
      .update({
        status: 'matched',
        spotify_track_id,
        spotify_track_name,
        spotify_artist_name,
        spotify_url,
        spotify_album_name,
        spotify_album_image,
        spotify_preview_url,
        spotify_duration_ms,
        spotify_popularity,
        spotify_match_confidence: 0.95,
        suggested_matches: null,
        review_notes: notes || null,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', track_id)
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Match aggiornato manualmente'
    })
    
  } catch (error: any) {
    console.error('Update match error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
