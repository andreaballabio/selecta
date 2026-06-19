import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

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
    
    const token = await getSpotifyToken()
    
    // Cerca tracce su Spotify
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=10`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    if (!response.ok) {
      const error = await response.json()
      return NextResponse.json(
        { error: 'Errore Spotify', details: error },
        { status: response.status }
      )
    }
    
    const data = await response.json()
    
    // Formatta risultati
    const tracks = data.tracks?.items?.map((track: any) => ({
      id: track.id,
      name: track.name,
      artist: track.artists?.map((a: any) => a.name).join(', '),
      album: track.album?.name,
      image: track.album?.images?.[0]?.url,
      preview_url: track.preview_url,
      url: track.external_urls?.spotify,
      duration_ms: track.duration_ms,
      duration_formatted: formatDuration(track.duration_ms),
      popularity: track.popularity,
      explicit: track.explicit
    })) || []
    
    return NextResponse.json({
      success: true,
      tracks,
      total: data.tracks?.total || 0
    })
    
  } catch (error: any) {
    console.error('Search Spotify error:', error)
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
