import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY
const YOUTUBE_API_URL = 'https://www.googleapis.com/youtube/v3'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cerca canali YouTube per label
async function searchYouTubeChannels(query: string) {
  try {
    const response = await fetch(
      `${YOUTUBE_API_URL}/search?part=snippet&q=${encodeURIComponent(query + ' label')}&type=channel&maxResults=5&key=${YOUTUBE_API_KEY}`
    )
    
    if (!response.ok) {
      console.error('YouTube search error:', response.status)
      return null
    }
    
    const data = await response.json()
    const items = data.items || []
    
    // Ottieni dettagli per ogni canale
    const channelIds = items.map((item: any) => item.id.channelId).join(',')
    
    if (!channelIds) return []
    
    const detailsResponse = await fetch(
      `${YOUTUBE_API_URL}/channels?part=snippet,statistics&id=${channelIds}&key=${YOUTUBE_API_KEY}`
    )
    
    if (!detailsResponse.ok) return []
    
    const detailsData = await detailsResponse.json()
    const channels = detailsData.items || []
    
    // Ottieni video recenti per ogni canale (come esempio)
    const channelsWithVideos = await Promise.all(
      channels.map(async (channel: any) => {
        try {
          const videosResponse = await fetch(
            `${YOUTUBE_API_URL}/search?part=snippet&channelId=${channel.id}&order=date&maxResults=3&type=video&key=${YOUTUBE_API_KEY}`
          )
          
          let sampleVideos: Array<{title: string, artist: string}> = []
          
          if (videosResponse.ok) {
            const videosData = await videosResponse.json()
            sampleVideos = (videosData.items || [])
              .map((video: any) => {
                const title = video.snippet?.title || ''
                // Parsing: estrai artista e titolo
                let artist = 'Unknown'
                let trackTitle = title
                
                // Pattern comune: "Artista - Titolo"
                const match = title.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/)
                if (match) {
                  artist = match[1].trim()
                  trackTitle = match[2].trim()
                }
                
                return { title: trackTitle.substring(0, 50), artist: artist.substring(0, 40) }
              })
              .filter((v: any) => v.title.length > 3)
          }
          
          return {
            id: channel.id,
            name: channel.snippet?.title,
            description: channel.snippet?.description?.substring(0, 100),
            thumbnail: channel.snippet?.thumbnails?.medium?.url || channel.snippet?.thumbnails?.default?.url,
            videoCount: parseInt(channel.statistics?.videoCount) || 0,
            subscriberCount: parseInt(channel.statistics?.subscriberCount) || 0,
            sampleVideos
          }
        } catch (e) {
          return {
            id: channel.id,
            name: channel.snippet?.title,
            description: channel.snippet?.description?.substring(0, 100),
            thumbnail: channel.snippet?.thumbnails?.medium?.url,
            videoCount: parseInt(channel.statistics?.videoCount) || 0,
            subscriberCount: parseInt(channel.statistics?.subscriberCount) || 0,
            sampleVideos: []
          }
        }
      })
    )
    
    return channelsWithVideos.filter((c: any) => c.videoCount > 5) // Solo canali con contenuti
  } catch (error) {
    console.error('Error searching YouTube:', error)
    return null
  }
}

// Ottieni video da un canale
async function getChannelVideos(channelId: string, maxResults: number = 100) {
  const videos = []
  let pageToken = ''
  const maxPages = 5
  let pages = 0
  
  while (pages < maxPages) {
    try {
      const url = `${YOUTUBE_API_URL}/search?part=snippet&channelId=${channelId}&order=date&maxResults=50&type=video&key=${YOUTUBE_API_KEY}${pageToken ? `&pageToken=${pageToken}` : ''}`
      
      const response = await fetch(url)
      
      if (!response.ok) {
        console.error('YouTube videos error:', response.status)
        break
      }
      
      const data = await response.json()
      const items = data.items || []
      
      // Ottieni ID video per controllare durata
      const videoIds = items.map((item: any) => item.id?.videoId).filter(Boolean).join(',')
      
      if (videoIds) {
        const detailsUrl = `${YOUTUBE_API_URL}/videos?part=contentDetails,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`
        const detailsRes = await fetch(detailsUrl)
        
        if (detailsRes.ok) {
          const detailsData = await detailsRes.json()
          const videoDetails = detailsData.items || []
          
          for (const video of videoDetails) {
            // Parse durata ISO 8601 (PT4M12S)
            const duration = video.contentDetails?.duration
            if (!duration) continue
            
            const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
            if (!match) continue
            
            const hours = parseInt(match[1] || '0')
            const minutes = parseInt(match[2] || '0')
            const seconds = parseInt(match[3] || '0')
            const totalMinutes = hours * 60 + minutes + seconds / 60
            
            // FILTRO DURATA: solo tracce 1-9 minuti
            if (totalMinutes < 1 || totalMinutes > 9) continue
            
            const title = video.snippet?.title || ''
            const publishedAt = new Date(video.snippet?.publishedAt)
            
            // DEBUG: log per tracce escluse
            if (title.toLowerCase().includes('solid') || title.toLowerCase().includes('groove')) {
              console.log(`Video: ${title}, Duration: ${totalMinutes.toFixed(2)}min, Date: ${publishedAt.toISOString()}`)
            }
            
            // FILTRO DATA: ultimi 3 anni
            const cutoffDate = new Date()
            cutoffDate.setFullYear(cutoffDate.getFullYear() - 3)
            if (publishedAt < cutoffDate) {
              if (title.toLowerCase().includes('solid') || title.toLowerCase().includes('groove')) {
                console.log(`  -> SKIPPED: too old`)
              }
              continue
            }
            
            // Usa titolo completo, lascia che Spotify faccia il matching
            videos.push({
              title: title.substring(0, 150),
              artist: '', // Sarà estratto da Spotify
              videoId: video.id,
              publishedAt: video.snippet?.publishedAt,
              thumbnail: video.snippet?.thumbnails?.medium?.url,
              duration: Math.round(totalMinutes * 60) // in secondi
            })
          }
        }
      }
      
      pageToken = data.nextPageToken
      if (!pageToken || videos.length >= maxResults) break
      pages++
      
    } catch (error) {
      console.error('Error fetching videos:', error)
      break
    }
  }
  
  return videos.slice(0, maxResults)
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, genre, youtubeChannelId, youtubeUrl } = body
    
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nome e slug sono obbligatori' },
        { status: 400 }
      )
    }
    
    // Verifica se label esiste già
    const { data: existing } = await supabase
      .from('labels')
      .select('id')
      .eq('slug', slug)
      .single()
    
    if (existing) {
      return NextResponse.json(
        { error: 'Label già esistente' },
        { status: 409 }
      )
    }
    
    let channelId = youtubeChannelId
    let videos: any[] = []
    
    // Se fornito URL YouTube, estrai ID
    if (youtubeUrl && !channelId) {
      const match = youtubeUrl.match(/\/channel\/([a-zA-Z0-9_-]+)/)
      if (match) channelId = match[1]
    }
    
    // Se c'è un channel ID, recupera video
    if (channelId) {
      console.log(`Fetching videos for channel ${channelId}`)
      videos = await getChannelVideos(channelId, 200)
      console.log(`Found ${videos.length} videos`)
    }
    
    // Crea label nel database
    const labelData: any = {
      name,
      slug,
      source: channelId ? 'youtube' : 'manual',
      external_id: channelId,
      profile_url: youtubeUrl || `https://www.youtube.com/channel/${channelId}`,
    }
    
    if (genre) {
      labelData.primary_genre = genre
    }
    
    const { data: label, error: insertError } = await supabase
      .from('labels')
      .insert(labelData)
      .select()
      .single()
    
    if (insertError) {
      console.error('Error creating label:', insertError)
      
      if (insertError.code === '23505' || insertError.message?.includes('duplicate')) {
        return NextResponse.json(
          { error: 'Label già esistente. Prova con un altro nome o slug.' },
          { status: 409 }
        )
      }
      
      return NextResponse.json(
        { error: `Errore nel creare la label: ${insertError.message}` },
        { status: 500 }
      )
    }
    
    // Aggiungi video alla coda di ingestion
    let tracksAdded = 0
    
    if (videos.length > 0) {
      const queueItems = videos.map(video => ({
        label_id: label.id,
        track_title: video.title,
        artist_name: video.artist,
        source: 'youtube',
        source_id: video.videoId,
        source_url: `https://www.youtube.com/watch?v=${video.videoId}`,
        status: 'pending',
        attempts: 0
      }))
      
      // Inserisci in batch
      const batchSize = 100
      for (let i = 0; i < queueItems.length; i += batchSize) {
        const batch = queueItems.slice(i, i + batchSize)
        const { error: queueError } = await supabase
          .from('label_ingestion_queue')
          .insert(batch)
        
        if (queueError) {
          console.error('Error adding to queue:', queueError)
        } else {
          tracksAdded += batch.length
        }
      }
      
      // Aggiorna contatore
      await supabase
        .from('labels')
        .update({ cataloged_tracks: tracksAdded })
        .eq('id', label.id)
    }
    
    return NextResponse.json({
      success: true,
      message: tracksAdded > 0 
        ? `Label aggiunta con ${tracksAdded} tracce in coda per matching`
        : 'Label aggiunta (nessuna traccia trovata su YouTube)',
      label: {
        id: label.id,
        name: label.name,
        slug: label.slug,
        source: label.source,
        tracksQueued: tracksAdded
      }
    })
    
  } catch (error: any) {
    console.error('Error in add-label:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// GET: Cerca canali YouTube
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    
    if (!query || query.length < 3) {
      return NextResponse.json(
        { error: 'Query troppo corta' },
        { status: 400 }
      )
    }
    
    if (!YOUTUBE_API_KEY) {
      return NextResponse.json(
        { error: 'YouTube API key non configurata' },
        { status: 500 }
      )
    }
    
    const results = await searchYouTubeChannels(query)
    
    if (!results) {
      return NextResponse.json(
        { error: 'Errore ricerca YouTube' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      results: results.map((c: any) => ({
        id: c.id,
        name: c.name,
        description: c.description,
        thumbnail: c.thumbnail,
        videoCount: c.videoCount,
        subscriberCount: c.subscriberCount,
        sampleVideos: c.sampleVideos
      }))
    })
    
  } catch (error: any) {
    console.error('Error searching YouTube:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
