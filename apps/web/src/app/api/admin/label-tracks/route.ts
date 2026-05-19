import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    const status = searchParams.get('status')
    
    if (!labelId) {
      return NextResponse.json({ error: 'Label ID richiesto' }, { status: 400 })
    }
    
    // Ottieni nome label
    const { data: label } = await supabase
      .from('labels')
      .select('name')
      .eq('id', labelId)
      .single()
    
    // Query tracce
    let query = supabase
      .from('label_ingestion_queue')
      .select(`
        id, 
        track_title, 
        artist_name, 
        status, 
        spotify_track_id,
        spotify_track_name,
        spotify_artist_name,
        spotify_url,
        spotify_album_name,
        spotify_album_image,
        spotify_preview_url,
        spotify_duration_ms,
        spotify_match_confidence,
        suggested_matches,
        created_at
      `)
      .eq('label_id', labelId)
      .order('created_at', { ascending: false })
    
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data: tracks, error } = await query.limit(500)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      labelName: label?.name || 'Unknown',
      tracks: tracks || []
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
