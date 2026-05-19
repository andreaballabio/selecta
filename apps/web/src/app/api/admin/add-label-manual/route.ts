import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, genre, tracks } = body
    
    if (!name || !slug || !tracks || tracks.length === 0) {
      return NextResponse.json(
        { error: 'Nome, slug e tracce sono obbligatori' },
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
    
    // Crea label
    const labelData: any = {
      name,
      slug,
      source: 'manual',
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
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }
    
    // Aggiungi tracce alla coda
    const queueItems = tracks.map((track: any) => ({
      label_id: label.id,
      track_title: track.title,
      artist_name: track.artist,
      source: 'manual',
      status: 'pending',
      attempts: 0
    }))
    
    const { error: queueError } = await supabase
      .from('label_ingestion_queue')
      .insert(queueItems)
    
    if (queueError) {
      console.error('Queue error:', queueError)
    }
    
    // Aggiorna contatore
    await supabase
      .from('labels')
      .update({ cataloged_tracks: tracks.length })
      .eq('id', label.id)
    
    return NextResponse.json({
      success: true,
      message: `Label creata con ${tracks.length} tracce`,
      label: {
        id: label.id,
        name: label.name,
        slug: label.slug,
        tracksQueued: tracks.length
      }
    })
    
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
