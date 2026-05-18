import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DISCOGS_API_URL = 'https://api.discogs.com'

// Inizializza Supabase Admin
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Cerca label su Discogs con dettagli
async function searchDiscogsLabel(query: string) {
  try {
    // Prima chiamata: ricerca base
    const searchResponse = await fetch(
      `${DISCOGS_API_URL}/database/search?q=${encodeURIComponent(query)}&type=label&per_page=5`,
      {
        headers: {
          'User-Agent': 'SelectaApp/1.0'
        }
      }
    )
    
    if (!searchResponse.ok) {
      console.error('Discogs search error:', searchResponse.status)
      return null
    }
    
    const searchData = await searchResponse.json()
    const results = searchData.results || []
    
    // Per ogni risultato, ottieni dettagli
    const detailedResults = await Promise.all(
      results.map(async (result: any) => {
        try {
          // Ottieni dettagli label
          const detailRes = await fetch(
            `${DISCOGS_API_URL}/labels/${result.id}?curr_abbr=USD`,
            {
              headers: { 'User-Agent': 'SelectaApp/1.0' }
            }
          )
          
          if (!detailRes.ok) {
            return {
              id: result.id,
              name: result.title,
              url: `https://www.discogs.com/label/${result.id}`,
              thumbnail: result.thumb || result.cover_image,
              releases: result.releases_count || result.release_count || 0,
              profile: '',
              sampleReleases: []
            }
          }
          
          const detail = await detailRes.json()
          
          // Ottieni alcune releases come esempio
          const releasesRes = await fetch(
            `${DISCOGS_API_URL}/labels/${result.id}/releases?per_page=3`,
            {
              headers: { 'User-Agent': 'SelectaApp/1.0' }
            }
          )
          
          let sampleReleases: Array<{title: string, artist: string}> = []
          if (releasesRes.ok) {
            const releasesData = await releasesRes.json()
            sampleReleases = (releasesData.releases || [])
              .slice(0, 3)
              .map((r: any) => {
                // Estrai artista e titolo
                const fullTitle = r.title || ''
                let artist = 'Various Artists'
                let title = fullTitle
                
                // Formato comune: "Artista - Titolo"
                const dashMatch = fullTitle.match(/^(.+?)\s+-\s+(.+)$/)
                if (dashMatch) {
                  artist = dashMatch[1].trim()
                  title = dashMatch[2].trim()
                } else if (r.artist) {
                  artist = r.artist
                }
                
                return {
                  artist,
                  title: title.length > 40 ? title.substring(0, 40) + '...' : title
                }
              })
          }
          
          return {
            id: result.id,
            name: detail.name || result.title,
            url: `https://www.discogs.com/label/${result.id}`,
            thumbnail: detail.images?.[0]?.uri || detail.images?.[0]?.resource_url || result.thumb || result.cover_image,
            releases: detail.releases_count || detail.num_releases || detail.num_items || result.releases_count || result.release_count || 0,
            profile: detail.profile || '',
            sampleReleases
          }
        } catch (e) {
          // Fallback su dati base
          return {
            id: result.id,
            name: result.title,
            url: `https://www.discogs.com/label/${result.id}`,
            thumbnail: result.thumb || result.cover_image,
            releases: result.releases_count || 0,
            profile: '',
            sampleReleases: []
          }
        }
      })
    )
    
    return detailedResults
  } catch (error) {
    console.error('Error searching Discogs:', error)
    return null
  }
}

// Ottieni releases di una label da Discogs
async function getDiscogsReleases(labelId: number) {
  const releases = []
  let page = 1
  const perPage = 100
  const maxPages = 5 // Max 500 releases per label
  
  while (page <= maxPages) {
    try {
      const response = await fetch(
        `${DISCOGS_API_URL}/labels/${labelId}/releases?page=${page}&per_page=${perPage}`,
        {
          headers: {
            'User-Agent': 'SelectaApp/1.0'
          }
        }
      )
      
      if (!response.ok) break
      
      const data = await response.json()
      if (!data.releases || data.releases.length === 0) break
      
      releases.push(...data.releases)
      
      if (data.releases.length < perPage) break
      page++
    } catch (error) {
      console.error('Error fetching releases:', error)
      break
    }
  }
  
  return releases
}

// Parsa artista e titolo da release Discogs
function parseReleaseInfo(release: any) {
  const title = release.title || ''
  
  // Formati comuni:
  // "Artista - Titolo"
  // "Artista - Titolo (Remix)"
  // "Various - Compilation Title"
  
  let artist = ''
  let trackTitle = title
  
  // Cerca pattern "Artista - Titolo"
  const dashMatch = title.match(/^(.+?)\s+-\s+(.+)$/)
  if (dashMatch) {
    artist = dashMatch[1].trim()
    trackTitle = dashMatch[2].trim()
  } else {
    // Usa artist principale se disponibile
    artist = release.artist || 'Unknown Artist'
  }
  
  // Rimuovi versioni/edits dal titolo per matching migliore
  const cleanTitle = trackTitle
    .replace(/\s*[\(\[].*?(remix|edit|mix|version|original).*?[\)\]]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
  
  return {
    artist: artist.replace(/^Various$/i, 'VA'),
    title: cleanTitle,
    originalTitle: title,
    year: release.year,
    catalogNumber: release.catno
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, genre, discogsUrl, startIngestion = true } = body
    
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
    
    let discogsId: number | null = null
    let discogsReleases: any[] = []
    let tracksAdded = 0
    
    // Se fornito URL Discogs, estrai ID
    if (discogsUrl) {
      const match = discogsUrl.match(/\/label\/(\d+)/)
      if (match) {
        discogsId = parseInt(match[1])
      }
    }
    
    // Se non c'è URL, cerca su Discogs
    if (!discogsId) {
      const searchResults = await searchDiscogsLabel(name)
      if (searchResults && searchResults.length > 0) {
        // Prendi il primo risultato più rilevante
        discogsId = searchResults[0].id
      }
    }
    
    // Se trovata su Discogs, recupera releases
    if (discogsId && startIngestion) {
      console.log(`Fetching releases for label ${discogsId}`)
      discogsReleases = await getDiscogsReleases(discogsId)
      console.log(`Found ${discogsReleases.length} releases`)
    }
    
    // Crea label nel database
    const labelData: any = {
      name,
      slug,
      source: discogsId ? 'discogs' : 'manual',
      external_id: discogsId?.toString(),
      profile_url: discogsUrl,
    }
    
    // Aggiungi genre solo se specificato
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
      return NextResponse.json(
        { error: 'Errore nel creare la label' },
        { status: 500 }
      )
    }
    
    // Aggiungi releases alla coda di ingestion
    if (discogsReleases.length > 0) {
      const queueItems = discogsReleases
        .filter(release => release.title) // Solo release con titolo
        .map(release => {
          const parsed = parseReleaseInfo(release)
          return {
            label_id: label.id,
            track_title: parsed.title,
            artist_name: parsed.artist,
            release_year: parsed.year,
            album_name: parsed.originalTitle,
            catalog_number: parsed.catalogNumber,
            source: 'discogs',
            source_id: release.id?.toString(),
            source_url: release.resource_url,
            status: 'pending',
            attempts: 0
          }
        })
      
      if (queueItems.length > 0) {
        const { error: queueError } = await supabase
          .from('label_ingestion_queue')
          .insert(queueItems)
        
        if (queueError) {
          console.error('Error adding to queue:', queueError)
        } else {
          tracksAdded = queueItems.length
          
          // Aggiorna contatore tracce
          await supabase
            .from('labels')
            .update({ cataloged_tracks: tracksAdded })
            .eq('id', label.id)
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: tracksAdded > 0 
        ? `Label aggiunta con ${tracksAdded} tracce in coda per matching`
        : 'Label aggiunta (nessuna traccia trovata su Discogs)',
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

// GET: Cerca label su Discogs per suggerimenti
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
    
    const results = await searchDiscogsLabel(query)
    
    if (!results) {
      return NextResponse.json(
        { error: 'Errore ricerca Discogs' },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      results: results
        // Filtra duplicati simili (es. "Drumcode" e "Drumcode Records")
        .filter((r: any, index: number, self: any[]) => {
          const normalizedName = r.name.toLowerCase().replace(/\s+/g, '').replace(/records|recordings|music/g, '')
          return index === self.findIndex((t: any) => 
            t.name.toLowerCase().replace(/\s+/g, '').replace(/records|recordings|music/g, '') === normalizedName
          )
        })
        .map((r: any) => ({
          id: r.id,
          name: r.name,
          url: r.url,
          thumbnail: r.thumbnail,
          releases: r.releases,
          profile: r.profile,
          sampleReleases: r.sampleReleases
        }))
    })
    
  } catch (error: any) {
    console.error('Error searching Discogs:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
