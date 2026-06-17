/** Punteggio "hot" per le classifiche: engagement pesato + decadimento temporale. */
export interface ScoreCounts {
  play_count?: number | null
  likes_count?: number | null
  saves_count?: number | null
  published_at?: string | null
}

export function hotScore(t: ScoreCounts): number {
  const plays = t.play_count ?? 0
  const likes = t.likes_count ?? 0
  const saves = t.saves_count ?? 0
  // Il salvataggio (intento "la suonerei") pesa più del like, il like più del play.
  const engagement = plays * 1 + likes * 4 + saves * 8
  let recency = 1
  if (t.published_at) {
    const ageHours = (Date.now() - new Date(t.published_at).getTime()) / 3.6e6
    recency = Math.exp(-Math.max(0, ageHours) / (24 * 14)) // emivita ~2 settimane
  }
  return engagement * (0.4 + 0.6 * recency)
}
