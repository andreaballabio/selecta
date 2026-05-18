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
    
    // Search ALBUMS and check their labels
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&market=US`
    
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
    const albums = data.albums?.items || []
    
    // Find albums that match the label name (case insensitive)
    const queryLower = query.toLowerCase()
    const matchingAlbums = albums.filter((album: any) => {
      const labelName = album.label?.toLowerCase() || ''
      return labelName.includes(queryLower)
    })
    
    // Get unique labels
    const labelNames = new Set<string>()
    matchingAlbums.forEach((album: any) => {
      if (album.label) labelNames.add(album.label)
    })
    
    // Return verification result
    return NextResponse.json({
      found: matchingAlbums.length > 0,
      track_count: matchingAlbums.length,
      labels_found: Array.from(labelNames).slice(0, 5),
      sample_tracks: matchingAlbums.slice(0, 5).map((album: any) => ({
        name: album.name,
        artist: album.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
        album: album.name
      }))
    })
    
  } catch (error: any) {
    console.error('Error verifying label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
