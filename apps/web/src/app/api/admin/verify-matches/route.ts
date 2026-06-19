import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
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

// Cerca traccia su Deezer (primario)
async function searchDeezerTrack(query: string) {
  try {
    console.log('Searching Deezer for:', query)
    const response = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`,
      { headers: { 'Accept': 'application/json' } }
    )
    
    if (!response.ok) {
      console.log('Deezer search error:', response.status)
      return []
    }
    
    const data = await response.json()
    console.log('Deezer response:', { total: data.total, results: data.data?.length })
    
    if (!data.data || !Array.isArray(data.data)) {
      console.log('Deezer no data found')
      return []
    }
    
    return data.data.map((track: any) => ({
      id: `deezer_${track.id}`,
      name: track.title,
      artist: track.artist?.name,
      album: track.album?.title,
      image: track.album?.cover_medium || track.album?.cover,
      preview_url: track.preview,
      url: track.link,
      duration_ms: track.duration * 1000,
      duration_formatted: formatDuration(track.duration * 1000),
      rank: track.rank ? Math.min(Math.round(track.rank / 10000), 100) : undefined,
      explicit: track.explicit_lyrics,
      source: 'deezer',
      release_date: track.album?.release_date,
      genre: track.album?.genre?.name,
      contributors: track.contributors?.map((c: any) => c.name)
    }))
  } catch (error) {
    console.error('Deezer search error:', error)
    return []
  }
}

// Cerca traccia su Spotify (fallback)
async function searchSpotifyTrack(token: string, query: string) {
  try {
    const response = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    )
    
    if (!response.ok) return []
    
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
      source: 'spotify',
      release_date: track.album?.release_date
    }))
  } catch (error) {
    console.error('Spotify search error:', error)
    return []
  }
}

// GET: Ottieni tracce pending con match proposti da Deezer (primario) e Spotify (fallback)
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
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
    
    // Per ogni traccia, cerca match su Deezer (primario) e Spotify (fallback)
    const tracksWithMatches = await Promise.all(
      tracks.map(async (track) => {
        const query = `${track.artist_name} ${track.track_title}`
        
        // 1. Cerca su Deezer (primario)
        let matches = await searchDeezerTrack(query)
        
        // 2. Se Deezer trova poche tracce o nessuna con preview, aggiungi Spotify
        const deezerWithPreview = matches.filter((m: any) => m.preview_url).length
        
        if (matches.length === 0 || deezerWithPreview < 2) {
          try {
            const token = await getSpotifyToken()
            const spotifyMatches = await searchSpotifyTrack(token, query)
            
            // Aggiungi solo tracce Spotify che non sono già in lista
            const existingIds = new Set(matches.map((m: any) => `${m.name}_${m.artist}`.toLowerCase()))
            const uniqueSpotify = spotifyMatches.filter((m: any) => {
              const key = `${m.name}_${m.artist}`.toLowerCase()
              if (existingIds.has(key)) return false
              existingIds.add(key)
              return true
            })
            
            matches = [...matches, ...uniqueSpotify]
          } catch (e) {
            console.log('Spotify fallback failed:', e)
          }
        }
        
        // Ordina: prima quelle con preview, poi per rank
        matches.sort((a: any, b: any) => {
          if (a.preview_url && !b.preview_url) return -1
          if (!a.preview_url && b.preview_url) return 1
          return (b.rank || 0) - (a.rank || 0)
        })
        
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
  const denied = await requireAdminApi(); if (denied) return denied
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
      // Estrai source e ID originale
      const source = spotify_track.source || 'spotify'
      const originalId = spotify_track.id?.replace(/^(deezer_|spotify_)/, '') || spotify_track.id
      
      // Conferma il match con tutti i dati disponibili
      const updateData: any = {
        status: 'matched',
        spotify_track_id: originalId,
        spotify_track_name: spotify_track.name,
        spotify_artist_name: spotify_track.artist,
        spotify_url: spotify_track.url,
        spotify_album_name: spotify_track.album,
        spotify_album_image: spotify_track.image,
        spotify_preview_url: spotify_track.preview_url,
        spotify_duration_ms: spotify_track.duration_ms,
        spotify_popularity: spotify_track.rank || spotify_track.popularity,
        spotify_match_confidence: 0.95,
        reviewed_at: new Date().toISOString(),
        // Nuovi campi multi-source
        audio_source: source,
        audio_preview_url: spotify_track.preview_url,
        track_rank: spotify_track.rank || spotify_track.popularity,
        track_explicit: spotify_track.explicit,
        track_genre: spotify_track.genre,
        release_date: spotify_track.release_date
      }
      
      const { error } = await supabase
        .from('label_ingestion_queue')
        .update(updateData)
        .eq('id', track_id)
      
      if (error) {
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        )
      }
      
      return NextResponse.json({
        success: true,
        message: 'Match confermato',
        source: source,
        has_preview: !!spotify_track.preview_url
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
