import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Lista tutte le label o singola label
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (id) {
      // Singola label
      const { data: label, error } = await supabase
        .from('labels')
        .select('id, name, slug, source, primary_genre, cataloged_tracks, created_at')
        .eq('id', id)
        .single()
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      if (!label) {
        return NextResponse.json({ error: 'Label non trovata' }, { status: 404 })
      }
      
      return NextResponse.json({ label })
    } else {
      // Lista tutte le label
      const { data: labels, error } = await supabase
        .from('labels')
        .select('id, name, slug, source, primary_genre, cataloged_tracks, created_at')
        .order('created_at', { ascending: false })
      
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      return NextResponse.json({ labels: labels || [] })
    }
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// DELETE: Elimina una label
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    
    if (!id) {
      return NextResponse.json({ error: 'ID richiesto' }, { status: 400 })
    }
    
    // Elimina prima le tracce in coda
    await supabase
      .from('label_ingestion_queue')
      .delete()
      .eq('label_id', id)
    
    // Poi elimina la label
    const { error } = await supabase
      .from('labels')
      .delete()
      .eq('id', id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
