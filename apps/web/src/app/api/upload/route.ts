import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Utente loggato (opzionale): se c'è, i file finiscono sotto il SUO id; se non
    // c'è, l'upload anonimo resta permesso (cartella "anonymous") — è il gancio
    // gratuito del /match. Niente più id fittizio condiviso da tutti.
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id ?? 'anonymous'
    
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
