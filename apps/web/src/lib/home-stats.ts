// Config dei numeri mostrati nella home (banda "numeri reali").
// Per ogni metrica: un valore MANUALE mostrato finché il reale è sotto la
// SOGLIA; raggiunta la soglia, si mostra automaticamente il numero reale.
// Salvata in app_settings (chiave "home_stats"). Vedi [[founding]] per il pattern.

export type StatKey = 'analyzed' | 'published' | 'artists'
export const STAT_KEYS: StatKey[] = ['analyzed', 'published', 'artists']
export const STAT_LABELS: Record<StatKey, string> = {
  analyzed: 'Tracce analizzate',
  published: 'Nel catalogo',
  artists: 'Artisti',
}

export type StatRule = { manual: number; threshold: number }
export type HomeStatsConfig = Record<StatKey, StatRule>

export const DEFAULT_HOME_STATS: HomeStatsConfig = {
  analyzed: { manual: 1200, threshold: 500 },
  published: { manual: 250, threshold: 150 },
  artists: { manual: 150, threshold: 80 },
}

const num = (v: unknown, fallback: number) => {
  const n = typeof v === 'string' ? Number(v) : (v as number)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : fallback
}

/** Normalizza/sanifica una config arbitraria (con default per i campi mancanti). */
export function mergeHomeStats(v: unknown): HomeStatsConfig {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, Partial<StatRule>>
  const rule = (k: StatKey): StatRule => ({
    manual: num(o[k]?.manual, DEFAULT_HOME_STATS[k].manual),
    threshold: num(o[k]?.threshold, DEFAULT_HOME_STATS[k].threshold),
  })
  return { analyzed: rule('analyzed'), published: rule('published'), artists: rule('artists') }
}

/** Valore da mostrare: il reale se ha raggiunto la soglia, altrimenti il manuale. */
export function displayStat(real: number, rule: StatRule): number {
  return real >= rule.threshold ? real : rule.manual
}
