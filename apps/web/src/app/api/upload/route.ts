import { createClient } from '@/lib/supabase/route-handler'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

/**
 * Rete di sicurezza SENZA job schedulati: a ogni nuovo upload, ripulisce (max
 * 25 per volta) l'audio delle analisi vecchie >24h mai pubblicate — copre i
 * casi in cui il "discard" client (beacon) non è arrivato (tab chiusa male,
 * analisi abbandonata a metà). Best-effort: un errore qui non blocca l'upload.
 */
async function sweepAbandonedAudio() {
  try {
    const sb = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
    )
    const cutoff = new Date(Date.now() - 24 * 3600 * 1000).toISOString()
    const { data } = await sb
      .from('user_submissions')
      .select('id, file_url')
      .eq('published', false)
      .in('analysis_status', ['analyzed', 'failed'])
      .not('file_url', 'is', null)
      .lt('created_at', cutoff)
      .limit(25)
    const rows = (data ?? []) as { id: string; file_url: string }[]
    if (rows.length === 0) return
    const paths = rows
      .map((r) => String(r.file_url).split('?')[0].match(/audio-tracks\/(.+)$/)?.[1])
      .filter((p): p is string => !!p)
      .map((p) => decodeURIComponent(p))
    if (paths.length) await sb.storage.from('audio-tracks').remove(paths)
    await sb.from('user_submissions').update({ file_url: null }).in('id', rows.map((r) => r.id))
  } catch { /* best-effort */ }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Utente loggato (opzionale): se c'è, i file finiscono sotto il SUO id; se non
    // c'è, l'upload anonimo resta permesso (cartella "anonymous") — è il gancio
    // gratuito del /match. Niente più id fittizio condiviso da tutti.
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? 'anonymous'

    // pulizia opportunistica (vedi sopra) — non blocca in caso d'errore
    await sweepAbandonedAudio()
    
    const body = await request.json()
    const { fileName, fileSize, contentType } = body
    
    if (!fileName || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Limite dimensione (50MB: copre un WAV di ~5 min; protegge la quota Storage)
    if (fileSize > 50 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File troppo grande. Max 50MB (per i WAV lunghi usa un MP3 320).' },
        { status: 400 }
      )
    }
    
    // Generate unique file path
    const extension = fileName.split('.').pop()?.toLowerCase() || 'wav'
    const timestamp = Date.now()
    const filePath = `${userId}/${timestamp}-${randomUUID()}.${extension}`
    
    // Create signed upload URL
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio-tracks')
      .createSignedUploadUrl(filePath)
    
    if (uploadError) {
      console.error('Upload URL error:', uploadError)
      return NextResponse.json(
        { error: 'Failed to create upload URL' },
        { status: 500 }
      )
    }
    
    // Get public URL for the file
    const { data: publicUrlData } = supabase.storage
      .from('audio-tracks')
      .getPublicUrl(filePath)
    
    return NextResponse.json({
      uploadUrl: uploadData.signedUrl,
      filePath,
      publicUrl: publicUrlData.publicUrl,
    })
    
  } catch (error) {
    console.error('Upload endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
