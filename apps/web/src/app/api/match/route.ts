import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

function parseEmbedding(raw: unknown): number[] {
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed.map((v) => parseFloat(String(v))) : []
    } catch {
      return []
    }
  }
  if (Array.isArray(raw)) return (raw as (string | number)[]).map((v) => parseFloat(String(v)))
  return []
}

function cosineSimilarity(a: number[], b: number[]): number {
  const dot = a.reduce((sum, v, i) => sum + v * b[i], 0)
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0))
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0))
  return normA && normB ? dot / (normA * normB) : 0
}

function featureScore(track: Record<string, number>, label: Record<string, number>): number {
  // 8 features: spectral shape (4) + band ratios (2) + transients + timbro
  // Note: tempo_stability excluded — preview clips always return 0.5, making label profiles unreliable
  const checks = [
    // ── Spectral shape ───────────────────────────────────────────────────
    {
      t: track.spectral_centroid,
      l: label.avg_spectral_centroid,
      std: Math.max(label.std_spectral_centroid ?? 800, 200),
    },
    {
      t: track.spectral_rolloff,
      l: label.avg_spectral_rolloff,
      std: 1500, // Hz, fixed tolerance
    },
    {
      t: track.lufs,
      l: label.avg_lufs,
      std: 4.0, // dBLUFS, fixed tolerance
    },
    {
      t: track.zero_crossing_rate,
      l: label.avg_zero_crossing_rate,
      std: 0.03,
    },
    // ── Band energy ratios ───────────────────────────────────────────────
    {
      t: track.sub_ratio,
      l: label.avg_sub_ratio,
      std: Math.max(label.std_sub_ratio ?? 0.04, 0.01), // sub-bass fraction 0-1
    },
    {
      t: track.mid_presence,
      l: label.avg_mid_presence,
      std: 0.05, // mid-freq fraction 0-1, fixed tolerance
    },
    // ── Transient density ────────────────────────────────────────────────
    {
      t: track.onset_strength,
      l: label.avg_onset_strength,
      std: Math.max(label.std_onset_strength ?? 0.08, 0.02),
    },
    // ── Tonal vs noise ───────────────────────────────────────────────────
    {
      t: track.spectral_contrast,
      l: label.avg_spectral_contrast,
      std: 0.5, // log-domain, fixed tolerance
    },
  ]
  const scores = checks.map(({ t, l, std }) => {
    if (t == null || l == null) return 0.5
    const tol = Math.max(std * 1.5, 0.01)
    return Math.max(0, 1 - Math.abs(t - l) / tol)
  })
  return scores.reduce((s, v) => s + v, 0) / scores.length
}

function generateFeedback(track: Record<string, number>, label: Record<string, number>): string[] {
  const checks = [
    {
      diff: track.spectral_centroid - label.avg_spectral_centroid,
      thr: 400,
      hi: 'Il tuo mix è più brillante del sound tipico della label',
      lo: 'Il tuo mix è più dark del sound tipico della label',
    },
    {
      diff: track.spectral_rolloff - label.avg_spectral_rolloff,
      thr: 1200,
      hi: 'Le tue alte frequenze sono più presenti rispetto alla media',
      lo: 'Le tue alte frequenze sono più contenute rispetto alla media',
    },
    {
      diff: track.lufs - label.avg_lufs,
      thr: 3.0,
      hi: 'Il tuo master è più loud della media della label',
      lo: 'Il tuo master è più quiet della media della label',
    },
    {
      diff: track.zero_crossing_rate - label.avg_zero_crossing_rate,
      thr: 0.025,
      hi: 'La tua texture sonora è più ricca di transienti',
      lo: 'La tua texture sonora è più pulita e minimale',
    },
    {
      diff: track.sub_ratio - label.avg_sub_ratio,
      thr: 0.04,
      hi: 'Il tuo sound ha più sub-bass rispetto alla media della label',
      lo: 'Il tuo sound ha meno sub-bass rispetto alla media della label',
    },
    {
      diff: track.mid_presence - label.avg_mid_presence,
      thr: 0.04,
      hi: 'Le frequenze medie sono più presenti rispetto alla media della label',
      lo: 'Le frequenze medie sono più contenute rispetto alla media della label',
    },
    {
      diff: track.onset_strength - label.avg_onset_strength,
      thr: 0.08,
      hi: 'Il tuo sound è più percussivo e transient-rich della label',
      lo: 'Il tuo sound è più smooth e meno percussivo della label',
    },
  ]
  const lines: string[] = []
  for (const { diff, thr, hi, lo } of checks) {
    if (diff == null || isNaN(diff)) continue
    if (Math.abs(diff) > thr) lines.push(diff > 0 ? hi : lo)
  }
  if (lines.length === 0) return ['Il tuo sound è molto in linea con il profilo di questa label.']
  return lines.slice(0, 3)
}

async function processSubmission(submissionId: string, fileUrl: string, trackStatus: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    const workerRes = await fetch(`${WORKER_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        track_id: submissionId,
        file_url: fileUrl,
        is_preview: false,
        track_status: trackStatus,
      }),
      signal: AbortSignal.timeout(120_000),
    })

    if (!workerRes.ok) {
      throw new Error(`Worker error ${workerRes.status}: ${await workerRes.text()}`)
    }

    const workerData = await workerRes.json()
    // Worker may return features at top level or nested under .features
    const f: Record<string, number> = workerData.features ?? workerData

    const trackEmbedding: number[] = parseEmbedding(workerData.embedding ?? f.embedding)

    const { data: profiles } = await supabase
      .from('label_profiles')
      .select('*, labels(name, primary_genre)')
      .gte('analyzed_tracks_count', 3)

    const matchResults = (profiles ?? []).map((label: Record<string, unknown>) => {
      const labelEmbedding: number[] = parseEmbedding(label.avg_embedding)

      const rawCosine = cosineSimilarity(trackEmbedding, labelEmbedding)
      // Audio embeddings live in range ~0.5–1.0, rescale to 0–1 for meaningful scores
      const cosine = Math.max(0, (rawCosine - 0.5) / 0.5)
      const feat = featureScore(f, label as Record<string, number>)
      const confBoost = ((label.confidence_score as number) ?? 0) * 0.10
      const score = cosine * 0.55 + feat * 0.35 + confBoost

      const labelMeta = label.labels as { name: string; primary_genre: string } | null

      return {
        label_id: label.label_id as string,
        label_name: labelMeta?.name ?? 'Unknown',
        primary_genre: labelMeta?.primary_genre ?? '',
        score: Math.round(score * 1000) / 1000,
        confidence_score: (label.confidence_score as number) ?? 0,
        analyzed_tracks_count: (label.analyzed_tracks_count as number) ?? 0,
        feedback: generateFeedback(f, label as Record<string, number>),
      }
    })

    const top5 = matchResults.sort((a, b) => b.score - a.score).slice(0, 5)

    await supabase
      .from('user_submissions')
      .update({
        analysis_status: 'analyzed',
        bpm: f.bpm,
        key: workerData.key ?? f.key,
        scale: workerData.scale ?? f.scale,
        energy: f.energy,
        lufs: f.lufs,
        duration: f.duration,
        spectral_centroid: f.spectral_centroid,
        spectral_rolloff: f.spectral_rolloff,
        zero_crossing_rate: f.zero_crossing_rate,
        onset_strength: f.onset_strength,
        sub_ratio: f.sub_ratio,
        mid_presence: f.mid_presence,
        tempo_stability: f.tempo_stability,
        spectral_contrast: f.spectral_contrast,
        audio_embedding: trackEmbedding,
        match_results: top5,
      })
      .eq('id', submissionId)
  } catch (err) {
    console.error('[match] processing error:', err)
    await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
      .from('user_submissions')
      .update({ analysis_status: 'failed' })
      .eq('id', submissionId)
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { file_url, title, artist, track_status = 'unknown' } = body

  if (!file_url) {
    return NextResponse.json({ error: 'file_url required' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .insert({
      file_url,
      title: title ?? null,
      artist: artist ?? null,
      track_status,
      analysis_status: 'analyzing',
    })
    .select('id')
    .single()

  if (error || !submission) {
    console.error('[match] insert error:', error)
    return NextResponse.json({ error: 'Failed to create submission' }, { status: 500 })
  }

  after(() => processSubmission(submission.id, file_url, track_status))

  return NextResponse.json({ submission_id: submission.id })
}
