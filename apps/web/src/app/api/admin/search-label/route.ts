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
    
    // Search ARTISTS
    const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist`
    
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
    const artists = data.artists?.items || []
    
    // Get detailed artist info to extract label
    const artistDetails = await Promise.all(
      artists.slice(0, 5).map(async (artist: any) => {
        const detailRes = await fetch(`https://api.spotify.com/v1/artists/${artist.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        if (!detailRes.ok) return null
        return detailRes.json()
      })
    )
    
    // Also search for albums to get label info
    const albumUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=album`
    const albumRes = await fetch(albumUrl, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const albumData = albumRes.ok ? await albumRes.json() : { albums: { items: [] } }
    const albums = albumData.albums?.items || []
    
    // Extract unique labels from albums
    const labelMap = new Map<string, {
      name: string
      image: string | null
      count: number
      sampleArtists: Set<string>
    }>()
    
    for (const album of albums) {
      const labelName = album.label?.trim()
      if (!labelName || labelName === 'Unknown Label' || labelName === '') continue
      
      if (!labelMap.has(labelName)) {
        labelMap.set(labelName, {
          name: labelName,
          image: album.images?.[0]?.url || null,
          count: 0,
          sampleArtists: new Set()
        })
      }
      
      const label = labelMap.get(labelName)!
      label.count++
      album.artists?.forEach((a: any) => label.sampleArtists.add(a.name))
    }
    
    // If no labels found from albums, create synthetic results from search
    if (labelMap.size === 0) {
      // Check if any artist has this in their name
      const matchingArtists = artists.filter((a: any) => 
        a.name.toLowerCase().includes(query.toLowerCase())
      )
      
      if (matchingArtists.length > 0) {
        // Create a synthetic label result
        const mainArtist = matchingArtists[0]
        labelMap.set(query, {
          name: query.charAt(0).toUpperCase() + query.slice(1),
          image: mainArtist.images?.[0]?.url || null,
          count: matchingArtists.length,
          sampleArtists: new Set(matchingArtists.slice(0, 3).map((a: any) => a.name))
        })
      }
    }
    
    // Convert to array and sort
    const labels = Array.from(labelMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(label => ({
        name: label.name,
        image: label.image,
        album_count: label.count,
        sample_artists: Array.from(label.sampleArtists).slice(0, 5)
      }))
    
    return NextResponse.json({ labels })
    
  } catch (error: any) {
    console.error('Error searching labels:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
