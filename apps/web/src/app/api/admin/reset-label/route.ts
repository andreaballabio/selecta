import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { label_id } = body
    
    if (!label_id) {
      return NextResponse.json({ error: 'Label ID richiesto' }, { status: 400 })
    }
    
    // Resetta tutte le tracce a 'pending'
    const { error } = await supabase
      .from('label_ingestion_queue')
      .update({ 
        status: 'pending',
        attempts: 0,
        spotify_track_id: null,
        spotify_preview_url: null,
        spotify_match_confidence: null,
        last_error: null
      })
      .eq('label_id', label_id)
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, message: 'Label resettata' })
    
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
