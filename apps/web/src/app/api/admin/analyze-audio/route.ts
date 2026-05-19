import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const WORKER_URL = process.env.HF_WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

// GET: Ottieni statistiche analisi
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const labelId = searchParams.get('label_id')
    
    if (!labelId) {
      return NextResponse.json({ error: 'Label ID richiesto' }, { status: 400 })
    }
    
    // Conta tracce per stato analisi
    const { data: tracks, error } = await supabase
      .from('label_ingestion_queue')
      .select('analysis_status, status')
      .eq('label_id', labelId)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    const stats = {
      total: tracks?.length || 0,
      matched: tracks?.filter(t => t.status === 'matched').length || 0,
      analyzed: tracks?.filter(t => t.analysis_status === 'analyzed').length || 0,
      analyzing: tracks?.filter(t => t.analysis_status === 'analyzing').length || 0,
      pending: tracks?.filter(t => t.status === 'matched' && (t.analysis_status === 'pending' || t.analysis_status === null)).length || 0,
      failed: tracks?.filter(t => t.analysis_status === 'failed').length || 0
    }
    
    return NextResponse.json({
      success: true,
      stats
    })
    
  } catch (error: any) {
    console.error('Get analysis stats error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// POST: Analizza un batch di tracce
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { track_id, label_id } = body
    
    // Se viene passato un track_id specifico, analizza solo quella
    if (track_id) {
      const result = await analyzeSingleTrack(track_id)
      return NextResponse.json(result)
    }
    
    // Altrimenti, trova la prossima traccia da analizzare per la label
    if (label_id) {
      // Query semplificata: cerca solo per status matched e preview presente
      // Ignora completamente analysis_status per ora
      const { data: tracks, error } = await supabase
        .from('label_ingestion_queue')
        .select('id, track_title, artist_name, spotify_preview_url, analysis_status')
        .eq('label_id', label_id)
        .eq('status', 'matched')
        .not('spotify_preview_url', 'is', null)
        .order('created_at', { ascending: true })
        .limit(10)
      
      if (error) {
        console.log('Supabase error:', error)
        return NextResponse.json({
          success: false,
          error: error.message,
          debug: { label_id }
        })
      }
      
      // Filtra manualmente quelle già analizzate
      const track = tracks?.find(t => 
        t.analysis_status === null || 
        t.analysis_status === '' || 
        t.analysis_status === 'pending'
      )
      
      if (!track) {
        return NextResponse.json({
          success: true,
          message: 'Nessuna traccia da analizzare',
          done: true,
          debug: { 
            label_id, 
            total_tracks: tracks?.length || 0,
            tracks_found: tracks?.map(t => ({ id: t.id, status: t.analysis_status }))
          }
        })
      }
      
      const result = await analyzeSingleTrack(track.id)
      return NextResponse.json(result)
    }
    
    return NextResponse.json(
      { error: 'track_id o label_id richiesto' },
      { status: 400 }
    )
    
  } catch (error: any) {
    console.error('Analyze track error:', error)
    return NextResponse.json(
      { error: error.message || 'Errore interno' },
      { status: 500 }
    )
  }
}

// Analizza una singola traccia
async function analyzeSingleTrack(trackId: string) {
  try {
    // Recupera info traccia
    const { data: track, error } = await supabase
      .from('label_ingestion_queue')
      .select('*')
      .eq('id', trackId)
      .single()
    
    if (error || !track) {
      return { success: false, error: 'Traccia non trovata' }
    }
    
    if (!track.spotify_preview_url) {
      // Aggiorna come failed (no preview)
      await supabase
        .from('label_ingestion_queue')
        .update({
          analysis_status: 'failed',
          analysis_error: 'Nessun preview audio disponibile'
        })
        .eq('id', trackId)
      
      return { success: false, error: 'Nessun preview audio' }
    }
    
    // Imposta come in analisi
    await supabase
      .from('label_ingestion_queue')
      .update({
        analysis_status: 'analyzing'
      })
      .eq('id', trackId)
    
    // Chiama il worker
    const response = await fetch(`${WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        track_id: trackId,
        file_url: track.spotify_preview_url,
        artist_level: 'established',
        title: track.track_title,
        artist: track.artist_name
      }),
      timeout: 120000 // 2 minuti timeout
    } as any)
    
    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Worker error: ${response.status} - ${errorText}`)
    }
    
    const result = await response.json()
    
    if (!result.success || !result.features) {
      throw new Error(result.error || 'Analisi fallita')
    }
    
    const features = result.features
    
    // Salva i risultati
    const { error: updateError } = await supabase
      .from('label_ingestion_queue')
      .update({
        analysis_status: 'analyzed',
        bpm: features.bpm,
        key: features.key,
        scale: features.scale,
        energy: features.energy,
        lufs: features.lufs,
        duration: features.duration,
        audio_embedding: features.embedding,
        analyzed_at: new Date().toISOString()
      })
      .eq('id', trackId)
    
    if (updateError) {
      throw new Error(`Errore salvataggio: ${updateError.message}`)
    }
    
    return {
      success: true,
      track_id: trackId,
      features: {
        bpm: features.bpm,
        key: features.key,
        scale: features.scale,
        energy: features.energy
      }
    }
    
  } catch (error: any) {
    console.error(`Error analyzing track ${trackId}:`, error)
    
    // Aggiorna come failed
    await supabase
      .from('label_ingestion_queue')
      .update({
        analysis_status: 'failed',
        analysis_error: error.message?.slice(0, 500) || 'Errore sconosciuto'
      })
      .eq('id', trackId)
    
    return {
      success: false,
      error: error.message,
      track_id: trackId
    }
  }
}
