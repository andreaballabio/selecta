import { type CatalogTrack } from '@/components/catalog/catalog-grid'
import { createAdminClient } from '@/lib/supabase/admin'
import { hotScore } from '@/lib/social'
import { HomeRedesign } from '@/components/marketing/home-redesign'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

async function getTopTracks(): Promise<CatalogTrack[]> {
  const sb = createAdminClient()
  const top = await sb
    .from('user_submissions')
    .select(SELECT)
    .eq('published', true)
    .order('likes_count', { ascending: false })
    .limit(24)
  return ((top.data ?? []) as (CatalogTrack & { published_at: string })[])
    .sort((a, b) => hotScore(b) - hotScore(a))
    .slice(0, 6)
}

export default async function HomePage() {
  const tracks = await getTopTracks()
  return <HomeRedesign tracks={tracks} />
}
