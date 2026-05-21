import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const label_id = searchParams.get('label_id')
  if (!label_id) return NextResponse.json({ error: 'label_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('label_profiles')
    .select('*')
    .eq('label_id', label_id)
    .single()

  if (error || !data) return NextResponse.json({ profile: null })
  return NextResponse.json({ profile: data })
}

export async function POST(request: NextRequest) {
  try {
    const { label_id } = await request.json()
    if (!label_id) return NextResponse.json({ error: 'label_id required' }, { status: 400 })

    // Prendi tutte le tracce analizzate della label
    const { data: tracks, error } = await supabase
      .from('label_ingestion_queue')
      .select(`
        energy, lufs, spectral_centroid, spectral_rolloff, spectral_contrast,
        zero_crossing_rate, onset_strength, sub_ratio,
        mid_presence, tempo_stability, audio_embedding
      `)
      .eq('label_id', label_id)
      .eq('analysis_status', 'analyzed')

    if (error) throw error
    if (!tracks || tracks.length === 0) {
      return NextResponse.json({ error: 'No analyzed tracks found' }, { status: 400 })
    }

    const count = tracks.length

    // Helper: media di un campo float
    const avg = (field: string) =>
      tracks.reduce((sum, t) => sum + (t[field] ?? 0), 0) / count

    // Helper: deviazione standard
    const std = (field: string) => {
      const mean = avg(field)
      const variance = tracks.reduce((sum, t) => sum + Math.pow((t[field] ?? 0) - mean, 2), 0) / count
      return Math.sqrt(variance)
    }

    // Embedding medio
    const validEmbeddings = tracks
      .map(t => t.audio_embedding)
      .filter(e => Array.isArray(e) && e.length === 64)
      .map(e => e.map((v: any) => parseFloat(v)))  // converti stringhe in numeri

    let avg_embedding: number[] | null = null
    if (validEmbeddings.length > 0) {
      avg_embedding = Array(64).fill(0)
      for (const emb of validEmbeddings) {
        for (let i = 0; i < 64; i++) avg_embedding[i] += emb[i]
      }
      avg_embedding = avg_embedding.map(v => v / validEmbeddings.length)
      // Normalizzazione L2
      const norm = Math.sqrt(avg_embedding.reduce((s, v) => s + v * v, 0))
      if (norm > 0) avg_embedding = avg_embedding.map(v => v / norm)
    }

    // Confidence score: cresce fino a 1.0 con 20 tracce
    const confidence_score = Math.min(count / 20, 1.0)

    const profile = {
      label_id,
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

    // Upsert — aggiorna se esiste, crea se non esiste
    const { error: upsertError } = await supabase
      .from('label_profiles')
      .upsert(profile, { onConflict: 'label_id' })

    if (upsertError) throw upsertError

    return NextResponse.json({ success: true, confidence_score, analyzed_tracks_count: count })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
