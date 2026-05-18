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
    
    // Search ALBUMS
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
    
    // Find albums that match the label name
    const queryLower = query.toLowerCase()
    const matchingAlbums = albums.filter((album: any) => {
      const labelName = album.label?.toLowerCase() || ''
      return labelName.includes(queryLower)
    })
    
    // Get tracks from first few albums to show as examples
    let sampleTracks: any[] = []
    let totalTracks = 0
    
    for (const album of matchingAlbums.slice(0, 3)) {
      // Get album tracks
      const tracksRes = await fetch(`https://api.spotify.com/v1/albums/${album.id}/tracks?limit=5`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      
      if (tracksRes.ok) {
        const tracksData = await tracksRes.json()
        const tracks = tracksData.items || []
        totalTracks += tracksData.total || 0
        
        sampleTracks = sampleTracks.concat(
          tracks.slice(0, 3).map((track: any) => ({
            name: track.name,
            artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
            album: album.name
          }))
        )
      }
    }
    
    // Get unique label names
    const labelNames = new Set<string>()
    matchingAlbums.forEach((album: any) => {
      if (album.label) labelNames.add(album.label)
    })
    
    // Return verification result
    return NextResponse.json({
      found: matchingAlbums.length > 0,
      album_count: matchingAlbums.length,
      track_count: totalTracks > 0 ? totalTracks : sampleTracks.length,
      labels_found: Array.from(labelNames).slice(0, 5),
      sample_tracks: sampleTracks.slice(0, 5)
    })
    
  } catch (error: any) {
    console.error('Error verifying label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
