import { createAdminClient } from './supabase/admin'
import { parseEmbedding, cosine, centroid } from './embedding'

const FIELDS = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count'

/**
 * Mix "Per te": centroide di gusto dalle tracce che l'utente ha messo like/salvato,
 * poi ranking delle tracce pubblicate più vicine (cosine). Cold-start → vuoto.
 */
export async function getMixForUser(userId: string, limit = 24) {
  const sb = createAdminClient()
  const [{ data: likes }, { data: saves }] = await Promise.all([
    sb.from('track_likes').select('submission_id').eq('user_id', userId).limit(300),
    sb.from('track_saves').select('submission_id').eq('user_id', userId).limit(300),
  ])
  const tasteIds = [...new Set([
    ...((likes ?? []) as { submission_id: string }[]).map((r) => r.submission_id),
    ...((saves ?? []) as { submission_id: string }[]).map((r) => r.submission_id),
  ])]
  if (tasteIds.length === 0) return { tracks: [], cold: true }

  const { data: tasteRows } = await sb.from('user_submissions').select('audio_embedding').in('id', tasteIds)
  const cen = centroid(((tasteRows ?? []) as { audio_embedding: unknown }[]).map((r) => parseEmbedding(r.audio_embedding)))
  if (cen.length === 0) return { tracks: [], cold: true }

  const { data: cands } = await sb
    .from('user_submissions')
    .select(`${FIELDS}, audio_embedding, user_id`)
    .eq('published', true)
    .neq('user_id', userId)
    .limit(400)

  const taste = new Set(tasteIds)
  const ranked = ((cands ?? []) as Record<string, unknown>[])
    .filter((c) => !taste.has(c.id as string))
    .map((c) => ({ c, sim: cosine(cen, parseEmbedding(c.audio_embedding)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(({ c }) => c)

  return { tracks: ranked as unknown as import('@/components/catalog/catalog-grid').CatalogTrack[], cold: false }
}

export const MIX_FIELDS = FIELDS
