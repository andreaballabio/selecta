import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

async function getSpotifyToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  return data.access_token
}

async function searchSpotifyTracks(labelName: string, token: string) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(`label:"${labelName}"`)}&type=track&limit=50&market=US`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )
  
  const data = await response.json()
  return data.tracks?.items || []
}

export async function POST(request: NextRequest) {
  try {
    const { name, slug, genre } = await request.json()
    
    if (!name || !slug || !genre) {
      return NextResponse.json({ error: 'Dati mancanti' }, { status: 400 })
    }
    
    const supabase = await createClient()
    
    // 1. Controlla se label esiste già
    const existing = await supabase
      .from('labels')
      .select('id')
      .eq('slug', slug)
      .single()
    
    if (existing.data) {
      return NextResponse.json({ error: 'Label già esistente' }, { status: 400 })
    }
    
    // 2. Crea label
    const { data: label, error: labelError } = await supabase
      .from('labels')
      .insert({
        name,
        slug,
        genre_focus: [genre],
        temporal_weight: 0.85,
        stylistic_variance: 0.3,
        total_tracks: 0
      })
      .select()
      .single()
    
    if (labelError || !label) {
      return NextResponse.json({ error: 'Errore creazione label' }, { status: 500 })
    }
    
    // 3. Cerca tracce su Spotify
    const token = await getSpotifyToken()
    const tracks = await searchSpotifyTracks(name, token)
    
    // 4. Filtra tracce con preview e recenti (ultimi 90 giorni)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    
    const recentTracks = tracks.filter((track: any) => {
      if (!track.preview_url) return false
      const releaseDate = new Date(track.album.release_date)
      return releaseDate >= cutoffDate
    })
    
    // 5. Aggiungi tracce al database
    let addedCount = 0
    for (const track of recentTracks.slice(0, 50)) {
      // Controlla se esiste già
      const existingTrack = await supabase
        .from('reference_tracks')
        .select('id')
        .eq('spotify_id', track.id)
        .single()
      
      if (existingTrack.data) continue
      
      // Inserisci
      const { error: trackError } = await supabase
        .from('reference_tracks')
        .insert({
          label_id: label.id,
          spotify_id: track.id,
          title: track.name,
          artist: track.artists.map((a: any) => a.name).join(', '),
          album: track.album.name,
          release_date: track.album.release_date,
          preview_url: track.preview_url,
          source: 'spotify',
          analysis_status: 'pending'
        })
      
      if (!trackError) addedCount++
    }
    
    // 6. Aggiorna contatore label
    await supabase
      .from('labels')
      .update({ total_tracks: addedCount })
      .eq('id', label.id)
    
    return NextResponse.json({
      success: true,
      label_id: label.id,
      tracks_added: addedCount,
      message: `Label "${name}" creata con ${addedCount} tracce`
    })
    
  } catch (error: any) {
    console.error('Error adding label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
