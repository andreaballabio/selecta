import { NextRequest, NextResponse } from 'next/server'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 3) {
      return NextResponse.json({ error: 'Query troppo corta' }, { status: 400 })
    }
    
    // Get token
    const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': 'Basic ' + Buffer.from(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET).toString('base64')
      },
      body: 'grant_type=client_credentials'
    })
    
    if (!tokenResponse.ok) {
      return NextResponse.json({ error: 'Errore autenticazione' }, { status: 500 })
    }
    
    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token
    
    // Search TRACKS with label filter
    const url = `https://api.spotify.com/v1/search?q=label:"${encodeURIComponent(query)}"&type=track&market=US&limit=20`
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      return NextResponse.json({ 
        error: `Spotify error: ${response.status}`,
        details: errorText
      }, { status: 500 })
    }
    
    const data = await response.json()
    const tracks = data.tracks?.items || []
    
    // Return verification result
    return NextResponse.json({
      found: tracks.length > 0,
      track_count: tracks.length,
      sample_tracks: tracks.slice(0, 5).map((track: any) => ({
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
        album: track.album?.name || 'Unknown'
      }))
    })
    
  } catch (error: any) {
    console.error('Error verifying label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
