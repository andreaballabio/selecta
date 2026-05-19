import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY! || process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, slug, genre } = body
    
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Nome e slug sono obbligatori' },
        { status: 400 }
      )
    }
    
    // Verifica se esiste già
    const { data: existing } = await supabase
      .from('labels')
      .select('id')
      .eq('slug', slug)
      .single()
    
    if (existing) {
      return NextResponse.json(
        { error: 'Slug già in uso' },
        { status: 409 }
      )
    }
    
    // Crea label
    const { data: label, error } = await supabase
      .from('labels')
      .insert({
        name,
        slug,
        primary_genre: genre,
        source: 'manual'
      })
      .select()
      .single()
    
    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }
    
    return NextResponse.json({
      success: true,
      label: {
        id: label.id,
        name: label.name,
        slug: label.slug
      }
    })
    
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
}
