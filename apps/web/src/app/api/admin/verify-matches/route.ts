import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Ottieni token Spotify
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

// Cerca traccia su Spotify
async function searchSpotifyTrack(token: string, query: string) {
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )
  
  if (!response.ok) return []
  
  const data = await response.json()
  return data.tracks?.items || []
}

// GET: Ottieni tracce pending con match proposti da Spotify
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    
    if (!labelId) {
      return NextResponse.json(
        { error: 'Label ID richiesto' },
        { status: 400 }
      )
    }
    
    // Ottieni tracce pending
    const { data: tracks, error } = await supabase
      .from('label_ingestion_queue')
      .select('*')
      .eq('label_id', labelId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(50)
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    if (!tracks || tracks.length === 0) {
      return NextResponse.json({
        success: true,
        tracks: [],
        message: 'Nessuna traccia da verificare'
      })
    }
    
    // Ottieni token Spotify
    const token = await getSpotifyToken()
    
    // Per ogni traccia, cerca match su Spotify
    const tracksWithMatches = await Promise.all(
      tracks.map(async (track) => {
        const query = `${track.artist_name} ${track.track_title}`
        const searchResults = await searchSpotifyTrack(token, query)
        
        // Formatta i risultati
        const matches = searchResults.map((t: any) => ({
          id: t.id,
          name: t.name,
          artist: t.artists?.map((a: any) => a.name).join(', '),
          album: t.album?.name,
          image: t.album?.images?.[0]?.url,
          preview_url: t.preview_url,
          url: t.external_urls?.spotify,
          duration_ms: t.duration_ms,
          duration_formatted: formatDuration(t.duration_ms),
          popularity: t.popularity
        }))
        
        return {
          ...track,
          proposed_matches: matches
        }
      })
    )
    
    return NextResponse.json({
      success: true,
      tracks: tracksWithMatches,
      total: tracksWithMatches.length
    })
    
  } catch (error: any) {
    console.error('Get pending tracks error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// POST: Conferma un match per una traccia
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { track_id, action, spotify_track } = body
    
    if (!track_id || !action) {
      return NextResponse.json(
        { error: 'Track ID e action richiesti' },
        { status: 400 }
      )
    }
    
    if (action === 'confirm' && spotify_track) {
      // Se non c'è preview_url, recupera i dettagli completi della traccia
      let trackDetails = spotify_track
      if (!spotify_track.preview_url) {
        try {
          const token = await getSpotifyToken()
          const detailResponse = await fetch(
            `https://api.spotify.com/v1/tracks/${spotify_track.id}`,
            { headers: { 'Authorization': `Bearer ${token}` } }
          )
          if (detailResponse.ok) {
            const fullTrack = await detailResponse.json()
            trackDetails = {
              ...spotify_track,
              preview_url: fullTrack.preview_url
            }
          }
        } catch (e) {
          console.log('Could not fetch track details:', e)
        }
      }
      
      // Conferma il match
      const { error } = await supabase
        .from('label_ingestion_queue')
        .update({
          status: 'matched',
          spotify_track_id: trackDetails.id,
          spotify_track_name: trackDetails.name,
          spotify_artist_name: trackDetails.artist,
          spotify_url: trackDetails.url,
          spotify_album_name: trackDetails.album,
          spotify_album_image: trackDetails.image,
          spotify_preview_url: trackDetails.preview_url,
          spotify_duration_ms: trackDetails.duration_ms,
          spotify_popularity: trackDetails.popularity,
          spotify_match_confidence: 0.95, // Confermato manualmente = alta confidence
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
        message: 'Match confermato'
      })
    }
    
    if (action === 'reject') {
      // Rifiuta il match
      const { error } = await supabase
        .from('label_ingestion_queue')
        .update({
          status: 'failed',
          spotify_match_confidence: 0,
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
        message: 'Match rifiutato'
      })
    }
    
    if (action === 'skip') {
      // Salta per ora (rimane pending)
      return NextResponse.json({
        success: true,
        message: 'Traccia saltata'
      })
    }
    
    return NextResponse.json(
      { error: 'Azione non valida' },
      { status: 400 }
    )
    
  } catch (error: any) {
    console.error('Confirm match error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

function formatDuration(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
