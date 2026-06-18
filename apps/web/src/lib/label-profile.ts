import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Ricostruisce il profilo sonoro di una label dalle sue tracce analizzate
 * (medie/deviazioni delle feature + embedding medio + confidence) e fa l'upsert
 * in `label_profiles`.
 *
 * Chiamata DIRETTA in-process (niente HTTP verso sé stessi): così non dipende da
 * NEXT_PUBLIC_APP_URL e non viene bloccata dal gate admin del proxy — era la
 * causa per cui i profili non venivano creati dopo l'analisi.
 */
export async function buildLabelProfile(
  supabase: SupabaseClient,
  labelId: string,
): Promise<{ ok: boolean; analyzed_tracks_count: number; confidence_score: number; error?: string }> {
  const { data: tracks, error } = await supabase
    .from('label_ingestion_queue')
    .select(`
      energy, lufs, spectral_centroid, spectral_rolloff, spectral_contrast,
      zero_crossing_rate, onset_strength, sub_ratio,
      mid_presence, tempo_stability, audio_embedding
    `)
    .eq('label_id', labelId)
    .eq('analysis_status', 'analyzed')

  if (error) return { ok: false, analyzed_tracks_count: 0, confidence_score: 0, error: error.message }
  if (!tracks || tracks.length === 0)
    return { ok: false, analyzed_tracks_count: 0, confidence_score: 0, error: 'No analyzed tracks' }

  const count = tracks.length
  const num = (v: unknown) => (typeof v === 'number' && !isNaN(v) ? v : 0)
  const avg = (field: string) => tracks.reduce((s, t) => s + num((t as any)[field]), 0) / count
  const std = (field: string) => {
    const mean = avg(field)
    const variance = tracks.reduce((s, t) => s + (num((t as any)[field]) - mean) ** 2, 0) / count
    return Math.sqrt(variance)
  }

  // Embedding medio (64-dim) normalizzato L2
  const validEmbeddings = tracks
    .map((t) => (t as any).audio_embedding)
    .map((e: unknown) => (typeof e === 'string' ? safeJson(e) : e))
    .filter((e: unknown): e is unknown[] => Array.isArray(e) && e.length === 64)
    .map((e) => (e as unknown[]).map((v) => parseFloat(String(v))))

  let avg_embedding: number[] | null = null
  if (validEmbeddings.length > 0) {
    avg_embedding = new Array(64).fill(0)
    for (const emb of validEmbeddings)
      for (let i = 0; i < 64; i++) avg_embedding[i] += emb[i] ?? 0
    avg_embedding = avg_embedding.map((v) => v / validEmbeddings.length)
    const norm = Math.sqrt(avg_embedding.reduce((s, v) => s + v * v, 0))
    if (norm > 0) avg_embedding = avg_embedding.map((v) => v / norm)
  }

  const confidence_score = Math.min(count / 20, 1.0) // satura a 1.0 con 20 tracce

  const profile = {
    label_id: labelId,
    updated_at: new Date().toISOString(),
    avg_energy: avg('energy'),
    avg_lufs: avg('lufs'),
    avg_spectral_centroid: avg('spectral_centroid'),
    avg_spectral_rolloff: avg('spectral_rolloff'),
    avg_spectral_contrast: avg('spectral_contrast'),
    avg_zero_crossing_rate: avg('zero_crossing_rate'),
    avg_onset_strength: avg('onset_strength'),
    avg_sub_ratio: avg('sub_ratio'),
    avg_mid_presence: avg('mid_presence'),
    avg_tempo_stability: avg('tempo_stability'),
    std_sub_ratio: std('sub_ratio'),
    std_onset_strength: std('onset_strength'),
    std_spectral_centroid: std('spectral_centroid'),
    avg_embedding,
    analyzed_tracks_count: count,
    confidence_score,
  }

  const { error: upsertError } = await supabase
    .from('label_profiles')
    .upsert(profile, { onConflict: 'label_id' })

  if (upsertError) return { ok: false, analyzed_tracks_count: count, confidence_score, error: upsertError.message }
  return { ok: true, analyzed_tracks_count: count, confidence_score }
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s) } catch { return null }
}
