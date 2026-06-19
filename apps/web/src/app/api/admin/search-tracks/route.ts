import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'

// Interfacce per i dati traccia
interface TrackMatch {
  id: string
  name: string
  artist: string
  album: string
  image: string | null
  preview_url: string | null
  url: string
  duration_ms: number
  duration_formatted: string
  bpm?: number
  rank?: number // Popolarità Deezer (0-100)
  explicit?: boolean
  source: 'deezer' | 'spotify'
  // Dati estesi
  release_date?: string
  disk_number?: number
  track_position?: number
  contributors?: string[] // Altri artisti
  genre?: string
}

// Cerca su Deezer
async function searchDeezer(query: string): Promise<TrackMatch[]> {
  try {
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    )
    
    if (!response.ok) {
      console.log('Deezer search error:', response.status)
      return []
    }
    
    const data = await response.json()
    
    if (!data.data || !Array.isArray(data.data)) {
      return []
    }
    
    return data.data.map((track: any) => ({
      id: `deezer_${track.id}`,
      name: track.title,
      artist: track.artist?.name,
      album: track.album?.title,
      image: track.album?.cover_medium || track.album?.cover,
      preview_url: track.preview, // 30s preview MP3
      url: track.link,
      duration_ms: track.duration * 1000,
      duration_formatted: formatDuration(track.duration * 1000),
      rank: track.rank ? Math.min(Math.round(track.rank / 10000), 100) : undefined, // Normalizza rank
      explicit: track.explicit_lyrics,
      source: 'deezer' as const,
      release_date: track.album?.release_date,
      disk_number: track.disk_number,
      track_position: track.track_position,
      contributors: track.contributors?.map((c: any) => c.name),
      genre: track.album?.genre?.name
    }))
  } catch (error) {
    console.error('Deezer search error:', error)
    return []
  }
}

// Cerca su Spotify (fallback)
async function searchSpotify(query: string, token: string): Promise<TrackMatch[]> {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      { headers: { 'Authorization': `Bearer ${token}` } }
    )
    
    if (!response.ok) {
      console.log('Spotify search error:', response.status)
      return []
    }
    
    const data = await response.json()
    
    return (data.tracks?.items || []).map((track: any) => ({
      id: `spotify_${track.id}`,
      name: track.name,
      artist: track.artists?.map((a: any) => a.name).join(', '),
      album: track.album?.name,
      image: track.album?.images?.[0]?.url,
      preview_url: track.preview_url,
      url: track.external_urls?.spotify,
      duration_ms: track.duration_ms,
      duration_formatted: formatDuration(track.duration_ms),
      rank: track.popularity,
      explicit: track.explicit,
      source: 'spotify' as const,
      release_date: track.album?.release_date
    }))
  } catch (error) {
    console.error('Spotify search error:', error)
    return []
  }
}

// Ottieni token Spotify
async function getSpotifyToken(): Promise<string> {
  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET
  
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
    },
    body: 'grant_type=client_credentials'
  })
  
  const data = await response.json()
  return data.access_token
}

// GET: Cerca tracce su Deezer (primario) e Spotify (fallback)
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: 'Query troppo corta (min 3 caratteri)' },
        { status: 400 }
      )
    }
    
    // 1. Cerca su Deezer (primario)
    console.log('Searching Deezer for:', query)
    let matches = await searchDeezer(query)
    console.log('Deezer found:', matches.length, 'tracks')
    
    // 2. Se Deezer trova poche tracce o nessuna con preview, aggiungi Spotify
    const deezerWithPreview = matches.filter(m => m.preview_url).length
    
    if (matches.length === 0 || deezerWithPreview < 3) {
      console.log('Falling back to Spotify')
      try {
        const token = await getSpotifyToken()
        const spotifyMatches = await searchSpotify(query, token)
        
        // Aggiungi solo tracce Spotify che non sono già in lista (evita duplicati)
        const existingIds = new Set(matches.map(m => `${m.name}_${m.artist}`.toLowerCase()))
        const uniqueSpotify = spotifyMatches.filter(m => {
          const key = `${m.name}_${m.artist}`.toLowerCase()
          if (existingIds.has(key)) return false
          existingIds.add(key)
          return true
        })
        
        matches = [...matches, ...uniqueSpotify]
        console.log('Added Spotify tracks:', uniqueSpotify.length)
      } catch (e) {
        console.log('Spotify fallback failed:', e)
      }
    }
    
    // Ordina: prima quelle con preview, poi per rank/popolarità
    matches.sort((a, b) => {
      // Priorità a quelle con preview
      if (a.preview_url && !b.preview_url) return -1
      if (!a.preview_url && b.preview_url) return 1
      
      // Poi per rank/popolarità
      const rankA = a.rank || 0
      const rankB = b.rank || 0
      return rankB - rankA
    })
    
    return NextResponse.json({
      success: true,
      tracks: matches,
      total: matches.length,
      with_preview: matches.filter(m => m.preview_url).length,
      sources: [...new Set(matches.map(m => m.source))]
    })
    
  } catch (error: any) {
    console.error('Search error:', error)
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
