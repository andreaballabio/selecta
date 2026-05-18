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
      const tokenError = await tokenResponse.text()
      console.error('Token error:', tokenResponse.status, tokenError)
      return NextResponse.json({ error: 'Errore autenticazione Spotify' }, { status: 500 })
    }
    
    const tokenData = await tokenResponse.json()
    const token = tokenData.access_token
    
    // Search for tracks with label filter using proper Spotify syntax
    const searchQuery = `label:"${query}"`
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(searchQuery)}&type=track&market=US`
    
    console.log('Searching Spotify:', url)
    
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('Spotify API error:', response.status, errorText)
      return NextResponse.json({ 
        error: `Spotify error: ${response.status}`,
        details: errorText
      }, { status: 500 })
    }
    
    const data = await response.json()
    const tracks = data.tracks?.items || []
    
    console.log(`Found ${tracks.length} tracks`)
    
    // Filter recent tracks (last 365 days for better results)
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - 365)
    
    const recentTracks = tracks.filter((track: any) => {
      try {
        const releaseDate = new Date(track.album?.release_date || '2020-01-01')
        return releaseDate >= cutoffDate
      } catch {
        return false
      }
    })
    
    // Prepare result
    const result = {
      name: query,
      tracks_found: recentTracks.length,
      tracks_with_preview: recentTracks.filter((t: any) => t.preview_url).length,
      sample_tracks: recentTracks.slice(0, 5).map((track: any) => ({
        name: track.name,
        artist: track.artists?.map((a: any) => a.name).join(', ') || 'Unknown',
        album: track.album?.name || 'Unknown',
        has_preview: !!track.preview_url
      }))
    }
    
    return NextResponse.json(result)
    
  } catch (error: any) {
    console.error('Error searching label:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
