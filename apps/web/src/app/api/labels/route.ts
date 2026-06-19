import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchDirectory, fetchLabelDetail } from '@/lib/labels'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? undefined
  const slug = searchParams.get('slug') ?? undefined

  if (id || slug) {
    const detail = await fetchLabelDetail(supabase, { id, slug })
    if (!detail) return NextResponse.json({ error: 'Label non trovata' }, { status: 404 })
    return NextResponse.json(detail)
  }
  const labels = await fetchDirectory(supabase)
  return NextResponse.json({ labels })
}
