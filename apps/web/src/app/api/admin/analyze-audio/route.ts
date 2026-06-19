import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createClient } from '@supabase/supabase-js'
import { analyzeSingleTrack } from '@/lib/analyze-track'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET: Ottieni statistiche analisi
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
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
  const denied = await requireAdminApi(); if (denied) return denied
  try {
    const body = await request.json()
    const { track_id, label_id } = body
    
    // Se viene passato un track_id specifico, analizza solo quella
    if (track_id) {
      const result = await analyzeSingleTrack(supabase, track_id)
      return NextResponse.json(result)
    }
    
    // Altrimenti, trova la prossima traccia da analizzare per la label
    if (label_id) {
      // Trova la prossima traccia pending — senza filtrare per URL:
      // analyzeSingleTrack gestisce il refresh automatico se l'URL è null
      const { data: tracks, error } = await supabase
        .from('label_ingestion_queue')
        .select('id, analysis_status')
        .eq('label_id', label_id)
        .eq('status', 'matched')
        .in('analysis_status', ['pending', ''])
        .order('created_at', { ascending: true })
        .limit(1)

      if (error) {
        return NextResponse.json({ success: false, error: error.message })
      }

      // Controlla anche analysis_status IS NULL con query separata se necessario
      let trackId = tracks?.[0]?.id ?? null
      if (!trackId) {
        const { data: nullTracks } = await supabase
          .from('label_ingestion_queue')
          .select('id')
          .eq('label_id', label_id)
          .eq('status', 'matched')
          .is('analysis_status', null)
          .order('created_at', { ascending: true })
          .limit(1)
        trackId = nullTracks?.[0]?.id ?? null
      }

      if (!trackId) {
        return NextResponse.json({
          success: true,
          message: 'Nessuna traccia da analizzare',
          done: true,
        })
      }

      const result = await analyzeSingleTrack(supabase, trackId)
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