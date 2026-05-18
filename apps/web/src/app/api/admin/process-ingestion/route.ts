import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

// Inizializza Supabase
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

// Cerca traccia su Spotify usando titolo completo
async function searchSpotifyTrack(token: string, fullTitle: string) {
  // Prova prima con il titolo completo (Spotify è bravo a parsare)
  let query = fullTitle
  
  const response = await fetch(
    `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=5`,
    {
      headers: { 'Authorization': `Bearer ${token}` }
    }
  )
  
  if (!response.ok) return []
  
  const data = await response.json()
  return data.tracks?.items || []
}

// Calcola similarità tra due stringhe (0-1)
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, '')
  const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, '')
  
  if (s1 === s2) return 1
  if (s1.length === 0 || s2.length === 0) return 0
  
  const longer = s1.length > s2.length ? s1 : s2
  const shorter = s1.length > s2.length ? s2 : s1
  
  let matches = 0
  for (let i = 0; i < shorter.length; i++) {
    if (longer.includes(shorter[i])) matches++
  }
  
  return matches / longer.length
}

// Calcola confidence score
function calculateConfidence(spotifyTrack: any, queryArtist: string, queryTitle: string): number {
  const norm = (s: string) => s.toLowerCase().replace(/[\(\[].*?[\)\]]/g, '').replace(/\s+/g, ' ').trim()
  
  const spotifyTitle = norm(spotifyTrack.name)
  const spotifyArtists = spotifyTrack.artists?.map((a: any) => norm(a.name)) || []
  const queryTitleNorm = norm(queryTitle)
  const queryArtistNorm = norm(queryArtist)
  
  // Score titolo (0-0.6)
  let titleScore = 0
  if (spotifyTitle === queryTitleNorm) titleScore = 0.6
  else if (spotifyTitle.includes(queryTitleNorm) || queryTitleNorm.includes(spotifyTitle)) titleScore = 0.45
  else {
    const commonWords = spotifyTitle.split(' ').filter((w: string) => queryTitleNorm.split(' ').includes(w))
    titleScore = (commonWords.length / Math.max(spotifyTitle.split(' ').length, queryTitleNorm.split(' ').length)) * 0.3
  }
  
  // Score artista (0-0.4)
  let artistScore = 0
  for (const artist of spotifyArtists) {
    if (artist === queryArtistNorm) { artistScore = 0.4; break }
    else if (artist.includes(queryArtistNorm) || queryArtistNorm.includes(artist)) artistScore = Math.max(artistScore, 0.25)
  }
  
  return Math.min(titleScore + artistScore, 1)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label_id, batch_size = 5 } = body
    
    // Ottieni token Spotify
    const token = await getSpotifyToken()
    
    // Query per tracce pending
    let query = supabase
      .from('label_ingestion_queue')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(batch_size)
    
    if (label_id) {
      query = query.eq('label_id', label_id)
    }
    
    const { data: tracks, error } = await query
    
    if (error) {
      console.error('Queue query error:', error)
      return NextResponse.json({ error: 'Errore database' }, { status: 500 })
    }
    
    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ 
        success: true, 
        message: 'Nessuna traccia da processare',
        processed: 0,
        stats: { matched: 0, needs_review: 0, failed: 0 }
      })
    }
    
    const stats = { matched: 0, needs_review: 0, failed: 0 }
    
    // Processa ogni traccia
    for (const track of tracks) {
      try {
        // Usa titolo completo dalla coda (da YouTube)
        const fullTitle = track.track_title
        
        const searchResults = await searchSpotifyTrack(token, fullTitle)
        
        if (searchResults.length === 0) {
          await supabase
            .from('label_ingestion_queue')
            .update({ 
              status: 'failed',
              attempts: track.attempts + 1 
            })
            .eq('id', track.id)
          stats.failed++
          continue
        }
        
        // Prendi il primo risultato (Spotify ordina per rilevanza)
        const bestMatch = searchResults[0]
        const spotifyArtist = bestMatch.artists?.map((a: any) => a.name).join(', ')
        const spotifyTitle = bestMatch.name
        
        // Confidence basata sulla posizione nei risultati
        let confidence = 0.8 // Default alto perché Spotify è bravo
        if (searchResults[0].popularity > 50) confidence += 0.1
        
        // Se il titolo è molto diverso, riduci confidence
        const titleSimilarity = calculateSimilarity(fullTitle.toLowerCase(), `${spotifyArtist} ${spotifyTitle}`.toLowerCase())
        if (titleSimilarity < 0.3) confidence = 0.5
        
        let status = 'failed'
        if (confidence >= 0.75) {
          status = 'matched'
          stats.matched++
        } else if (confidence >= 0.50) {
          status = 'needs_review'
          stats.needs_review++
        } else {
          stats.failed++
        }
        
        await supabase
          .from('label_ingestion_queue')
          .update({
            status,
            spotify_track_id: bestMatch?.id,
            spotify_preview_url: bestMatch?.preview_url,
            spotify_match_confidence: confidence,
            artist_name: spotifyArtist, // Aggiorna con artista da Spotify
            track_title: spotifyTitle,  // Aggiorna con titolo da Spotify
            attempts: track.attempts + 1
          })
          .eq('id', track.id)
          
      } catch (e) {
        console.error(`Error processing track ${track.id}:`, e)
        await supabase
          .from('label_ingestion_queue')
          .update({ 
            status: 'failed',
            attempts: track.attempts + 1,
            last_error: String(e).slice(0, 200)
          })
          .eq('id', track.id)
        stats.failed++
      }
    }
    
    // Conta totale rimanenti
    const { count } = await supabase
      .from('label_ingestion_queue')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending')
      .eq('label_id', label_id || (tracks[0]?.label_id))
    
    return NextResponse.json({
      success: true,
      processed: tracks.length,
      remaining: count || 0,
      stats
    })
    
  } catch (error: any) {
    console.error('Process ingestion error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// GET: Ottieni statistiche
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    
    let query = supabase
      .from('label_ingestion_queue')
      .select('status', { count: 'exact' })
    
    if (labelId) {
      query = query.eq('label_id', labelId)
    }
    
    const { data, error } = await query
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const counts: Record<string, number> = {}
    data?.forEach((row: any) => {
      counts[row.status] = (counts[row.status] || 0) + 1
    })
    
    return NextResponse.json({
      success: true,
      counts,
      total: data?.length || 0
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}