import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

/** Tier 3 (lato label): le demo/tracce utente che suonano come QUESTA label,
 *  ordinate per quanto le assomigliano. Sfrutta match_results già salvati. */
export async function GET(request: NextRequest) {
  const labelId = new URL(request.url).searchParams.get('label_id')
  if (!labelId) return NextResponse.json({ error: 'label_id richiesto' }, { status: 400 })

  // paginare le submission con match_results
  const rows: any[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from('user_submissions')
      .select('id, title, display_title, display_artist, artist, file_url, cover_url, match_results, created_at, user_id, published')
      .not('match_results', 'is', null)
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
  }

  const out = rows.map((s) => {
    const mr: any[] = Array.isArray(s.match_results) ? s.match_results : []
    const hit = mr.find((m) => m?.label_id === labelId)
    if (!hit) return null
    const rank = mr.findIndex((m) => m?.label_id === labelId) // 0 = top match
    return {
      id: s.id,
      title: s.display_title || s.title || 'Senza titolo',
      artist: s.display_artist || s.artist || '—',
      file_url: s.file_url,
      cover_url: s.cover_url,
      score: typeof hit.score === 'number' ? hit.score : 0,
      best_track: hit.best_track_title ? `${hit.best_track_artist ? hit.best_track_artist + ' — ' : ''}${hit.best_track_title}` : null,
      is_top: rank === 0,
      created_at: s.created_at,
      published: s.published,
    }
  }).filter(Boolean) as any[]

  out.sort((a, b) => b.score - a.score)
  return NextResponse.json({ demos: out.slice(0, 40), count: out.length })
}
