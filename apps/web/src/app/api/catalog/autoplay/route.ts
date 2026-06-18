import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { parseEmbedding, cosine } from '@/lib/embedding'
import { bucketByKey } from '@/lib/sound-bucket'

/**
 * Stazione/autoplay: dato l'id di una traccia, ritorna le tracce pubblicate più
 * simili (cosine sugli embedding), escludendo quelle già in coda. Alimenta la
 * riproduzione continua a fine coda — riusa lo stesso motore del match.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id') ?? ''
  const exclude = new Set((searchParams.get('exclude') ?? '').split(',').filter(Boolean))
  if (!id) return NextResponse.json({ tracks: [] })

  const sb = createAdminClient()
  const { data: seed } = await sb.from('user_submissions').select('audio_embedding').eq('id', id).maybeSingle()
  if (!seed) return NextResponse.json({ tracks: [] })
  const emb = parseEmbedding((seed as { audio_embedding: unknown }).audio_embedding)

  const { data: others } = await sb
    .from('user_submissions')
    .select('id, display_title, display_artist, cover_url, file_url, sound_bucket, audio_embedding')
    .eq('published', true)
    .neq('id', id)
    .limit(300)

  const ranked = (others ?? [])
    .filter((o) => !exclude.has((o as { id: string }).id))
    .map((o) => ({ o, sim: cosine(emb, parseEmbedding((o as { audio_embedding: unknown }).audio_embedding)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 8)
    .map(({ o }) => {
      const t = o as { id: string; display_title: string | null; display_artist: string | null; cover_url: string | null; file_url: string | null; sound_bucket: string | null }
      return { id: t.id, title: t.display_title, artist: t.display_artist, cover_url: t.cover_url, file_url: t.file_url, bucketLabel: bucketByKey(t.sound_bucket)?.label ?? null }
    })

  return NextResponse.json({ tracks: ranked })
}
