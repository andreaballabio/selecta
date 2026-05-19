import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { track_id, is_correct } = body
    
    if (!track_id) {
      return NextResponse.json(
        { error: 'Track ID richiesto' },
        { status: 400 }
      )
    }
    
    // Aggiorna stato traccia
    const { error } = await supabase
      .from('label_ingestion_queue')
      .update({
        status: is_correct ? 'matched' : 'failed',
        spotify_match_confidence: is_correct ? 0.95 : 0,
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
      message: is_correct ? 'Traccia confermata' : 'Traccia rifiutata'
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
