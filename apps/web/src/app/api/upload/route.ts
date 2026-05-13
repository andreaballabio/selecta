import { createClient } from '@/lib/supabase/route-handler'
import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // TEMP: Bypass authentication for testing
    const userId = 'anonymous-user-' + Date.now()
    
    const body = await request.json()
    const { fileName, fileSize, contentType } = body
    
    if (!fileName || !fileSize) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Validate file size (100MB max)
    if (fileSize > 100 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'File too large. Max 100MB.' },
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
