import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label_id, tracks } = body
    
    if (!label_id || !tracks || tracks.length === 0) {
      return NextResponse.json(
        { error: 'Label ID e tracce sono obbligatori' },
        { status: 400 }
      )
    }
    
    // Prepara tracce per la coda
    const queueItems = tracks.map((track: any) => ({
      label_id,
      track_title: track.title,
      artist_name: track.artist,
      source: 'manual',
      status: 'pending',
      attempts: 0
    }))
    
    // Inserisci tracce
    const { error } = await supabase
      .from('label_ingestion_queue')
      .insert(queueItems)
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    // Aggiorna contatore label
    const { data: current } = await supabase
      .from('labels')
      .select('cataloged_tracks')
      .eq('id', label_id)
      .single()
    
    await supabase
      .from('labels')
      .update({ 
        cataloged_tracks: (current?.cataloged_tracks || 0) + tracks.length 
      })
      .eq('id', label_id)
    
    return NextResponse.json({
      success: true,
      added: tracks.length
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
