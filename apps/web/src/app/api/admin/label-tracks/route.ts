import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    const status = searchParams.get('status')
    
    if (!labelId) {
      return NextResponse.json({ error: 'Label ID richiesto' }, { status: 400 })
    }
    
    // Ottieni nome label
    const { data: label } = await supabase
      .from('labels')
      .select('name')
      .eq('id', labelId)
      .single()
    
    // Query tracce
    let query = supabase
      .from('label_ingestion_queue')
      .select(`
        id, 
        track_title, 
        artist_name, 
        status, 
        spotify_track_id,
        spotify_track_name,
        spotify_artist_name,
        spotify_url,
        spotify_album_name,
        spotify_album_image,
        spotify_preview_url,
        spotify_duration_ms,
        spotify_match_confidence,
        suggested_matches,
        analysis_status,
        analysis_error,
        bpm,
        key,
        scale,
        energy,
        lufs,
        duration,
        audio_embedding,
        audio_source,
        audio_preview_url,
        track_rank,
        track_explicit,
        track_genre,
        release_date,
        onset_strength,
        sub_ratio,
        mid_presence,
        tempo_stability,
        spectral_contrast,
        created_at
      `)
      .eq('label_id', labelId)
      .order('created_at', { ascending: false })
    
    if (status && status !== 'all') {
      query = query.eq('status', status)
    }
    
    const { data: tracks, error } = await query.limit(500)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({
      labelName: label?.name || 'Unknown',
      tracks: tracks || []
    })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    const action = searchParams.get('action')
    
    if (!labelId) {
      return NextResponse.json({ error: 'Label ID richiesto' }, { status: 400 })
    }
    
    if (action === 'delete_all') {
      // Elimina tutte le tracce della label
      const { error, count } = await supabase
        .from('label_ingestion_queue')
        .delete({ count: 'exact' })
        .eq('label_id', labelId)
      
      if (error) {
        console.error('Error deleting tracks:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      
      // Resetta anche il profilo della label
      await supabase
        .from('label_profiles')
        .delete()
        .eq('label_id', labelId)
      
      return NextResponse.json({ 
        success: true, 
        deleted: count || 0,
        message: `${count || 0} tracce eliminate`
      })
    }
    
    return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })
    
  } catch (error: any) {
    console.error('Error in DELETE:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
