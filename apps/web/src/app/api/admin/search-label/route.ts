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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 3) {
      return NextResponse.json({ error: 'Query troppo corta' }, { status: 400 })
    }
    
    const token = await getSpotifyToken()
    
    // Search tracks - proviamo senza filtro label che dà problemi
    // Cerchiamo per artista che contiene il nome label
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=20&market=US`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify error:', response.status, errorText)
      return NextResponse.json({ error: `Errore Spotify: ${response.status}` }, { status: 500 })
    }
    
    const data = await response.json()
    const tracks = data.tracks?.items || []
    
    // Filter recent tracks (last 90 days)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 90)
    
    const recentTracks = tracks.filter((track: any) => {
      const releaseDate = new Date(track.album.release_date)
      return releaseDate >= cutoffDate
    })
    
    // Prepare result
    const result = {
      name: query,
      tracks_found: recentTracks.length,
      tracks_with_preview: recentTracks.filter((t: any) => t.preview_url).length,
      sample_tracks: recentTracks.slice(0, 5).map((track: any) => ({
        name: track.name,
        artist: track.artists.map((a: any) => a.name).join(', '),
        album: track.album.name,
        has_preview: !!track.preview_url
      }))
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Error searching label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
