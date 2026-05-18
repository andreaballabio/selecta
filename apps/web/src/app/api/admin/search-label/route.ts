import { NextRequest, NextResponse } from 'next/server'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 2) {
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
    
    // Search ALBUMS (not tracks) to find labels
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album&market=US&limit=50`
    
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
    
    // Group by label
    const labelMap = new Map<string, {
      name: string
      image: string | null
      albums: any[]
      artists: Set<string>
    }>()
    
    for (const album of albums) {
      const labelName = album.label?.trim()
      if (!labelName || labelName === 'Unknown Label') continue
      
      if (!labelMap.has(labelName)) {
        labelMap.set(labelName, {
          name: labelName,
          image: album.images?.[0]?.url || null,
          albums: [],
          artists: new Set()
        })
      }
      
      const label = labelMap.get(labelName)!
      label.albums.push({
        name: album.name,
        release_date: album.release_date
      })
      album.artists?.forEach((a: any) => label.artists.add(a.name))
    }
    
    // Convert to array and sort by relevance (more albums = higher relevance)
    const labels = Array.from(labelMap.values())
      .sort((a, b) => b.albums.length - a.albums.length)
      .slice(0, 10)
      .map(label => ({
        name: label.name,
        image: label.image,
        album_count: label.albums.length,
        sample_artists: Array.from(label.artists).slice(0, 5),
        sample_albums: label.albums.slice(0, 3).map((a: any) => a.name)
      }))
    
    return NextResponse.json({ labels })
    
  } catch (error: any) {
    console.error('Error searching labels:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
