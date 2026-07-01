import { type CatalogTrack } from '@/components/catalog/catalog-grid'
import { createAdminClient } from '@/lib/supabase/admin'
import { hotScore } from '@/lib/social'
import { getHomeStatsConfig, getRealStats } from '@/lib/home-stats-db'
import { displayStat } from '@/lib/home-stats'
import { HomeRedesign, type HomeStats } from '@/components/marketing/home-redesign'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

async function getHomeData(): Promise<{ tracks: CatalogTrack[]; stats: HomeStats }> {
  const sb = createAdminClient()
  const [top, cfg, real] = await Promise.all([
    sb.from('user_submissions').select(SELECT).eq('published', true).order('likes_count', { ascending: false }).limit(24),
    getHomeStatsConfig(sb),
    getRealStats(sb),
  ])
  const tracks = ((top.data ?? []) as (CatalogTrack & { published_at: string })[])
    .sort((a, b) => hotScore(b) - hotScore(a))
    .slice(0, 6)
  // numero mostrato = reale se ha raggiunto la soglia, altrimenti il manuale (admin)
  const stats: HomeStats = {
    analyzed: displayStat(real.analyzed, cfg.analyzed),
    published: displayStat(real.published, cfg.published),
    artists: displayStat(real.artists, cfg.artists),
  }
  return { tracks, stats }
}

export default async function HomePage() {
  const { tracks, stats } = await getHomeData()
  return <HomeRedesign tracks={tracks} stats={stats} />
}
