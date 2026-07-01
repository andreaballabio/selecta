import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeHomeStats, type HomeStatsConfig } from './home-stats'

const KEY = 'home_stats'

/** Legge la config dei numeri home da app_settings (default se assente). */
export async function getHomeStatsConfig(sb: SupabaseClient): Promise<HomeStatsConfig> {
  const { data } = await sb.from('app_settings').select('value').eq('key', KEY).maybeSingle()
  return mergeHomeStats((data as { value?: unknown } | null)?.value)
}

/** Salva la config dei numeri home. */
export async function setHomeStatsConfig(sb: SupabaseClient, config: HomeStatsConfig): Promise<void> {
  await sb.from('app_settings').upsert({ key: KEY, value: config, updated_at: new Date().toISOString() }, { onConflict: 'key' })
}

/** Conteggi reali usati nella home. */
export async function getRealStats(sb: SupabaseClient): Promise<Record<'analyzed' | 'published' | 'artists', number>> {
  const [pub, artists, analyzed] = await Promise.all([
    sb.from('user_submissions').select('id', { count: 'exact', head: true }).eq('published', true),
    sb.from('artist_profiles').select('user_id', { count: 'exact', head: true }),
    sb.from('user_submissions').select('id', { count: 'exact', head: true }).eq('analysis_status', 'analyzed'),
  ])
  return { analyzed: analyzed.count ?? 0, published: pub.count ?? 0, artists: artists.count ?? 0 }
}
