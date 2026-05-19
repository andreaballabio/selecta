import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const trackId = searchParams.get('id')
    
    if (!trackId) {
      return NextResponse.json(
        { error: 'Track ID richiesto' },
        { status: 400 }
      )
    }
    
    // Elimina la traccia
    const { error } = await supabase
      .from('label_ingestion_queue')
      .delete()
      .eq('id', trackId)
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      message: 'Traccia eliminata'
    })
    
  } catch (error: any) {
    console.error('Delete track error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { track_id, action } = body
    
    if (!track_id) {
      return NextResponse.json(
        { error: 'Track ID richiesto' },
        { status: 400 }
      )
    }
    
    if (action === 'reset') {
      // Resetta la traccia a pending per rianalisi
      const { error } = await supabase
        .from('label_ingestion_queue')
        .update({
          status: 'pending',
          spotify_track_id: null,
          spotify_track_name: null,
          spotify_artist_name: null,
          spotify_url: null,
          spotify_album_name: null,
          spotify_album_image: null,
          spotify_preview_url: null,
          spotify_duration_ms: null,
          spotify_popularity: null,
          spotify_match_confidence: null,
          suggested_matches: null,
          attempts: 0,
          last_error: null
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
        message: 'Traccia resettata per rianalisi'
      })
    }
    
    return NextResponse.json(
      { error: 'Azione non valida' },
      { status: 400 }
    )
    
  } catch (error: any) {
    console.error('Track action error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}
