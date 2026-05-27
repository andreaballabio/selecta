import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

// ─── Tuning parameters ───────────────────────────────────────────────────────
/** Min analyzed tracks for a label to appear in results */
const MIN_LABEL_TRACKS = 3
/** Top-K tracks per label used to compute quality average */
const TOP_K_PER_LABEL = 10
/** Minimum combined score for a track to count as a "good match"
 *  (used for coverage weight only — does not gate inclusion) */
const GOOD_MATCH_THRESHOLD = 0.30
// ─────────────────────────────────────────────────────────────────────────────

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
  if (a.length === 0 || b.length === 0) return 0
  const dot = a.reduce((sum, v, i) => sum + v * (b[i] ?? 0), 0)
  const normA = Math.sqrt(a.reduce((sum, v) => sum + v * v, 0))
  const normB = Math.sqrt(b.reduce((sum, v) => sum + v * v, 0))
  return normA && normB ? dot / (normA * normB) : 0
}

/**
 * Feature similarity between the user's track and a single DB track.
 * Uses fixed tolerances (no per-label std available for individual tracks).
 * Returns 0–1 where 1 = identical.
 */
function trackFeatureSimilarity(
  user: Record<string, number>,
  db: Record<string, number | null>
): number {
  const checks: { t: number | undefined; l: number | null | undefined; tol: number }[] = [
    // Spectral shape
    { t: user.spectral_centroid,  l: db.spectral_centroid,  tol: 1200  },
    { t: user.spectral_rolloff,   l: db.spectral_rolloff,   tol: 2250  },
    { t: user.zero_crossing_rate, l: db.zero_crossing_rate, tol: 0.045 },
    // Dynamics
    { t: user.lufs,               l: db.lufs,               tol: 6.0   },
    // Band energy
    { t: user.sub_ratio,          l: db.sub_ratio,          tol: 0.06  },
    { t: user.mid_presence,       l: db.mid_presence,       tol: 0.075 },
    // Transients
    { t: user.onset_strength,     l: db.onset_strength,     tol: 0.12  },
    // Tonal definition
    { t: user.spectral_contrast,  l: db.spectral_contrast,  tol: 0.75  },
  ]
  const scores = checks.map(({ t, l, tol }) => {
    if (t == null || l == null) return 0.5 // neutral when data missing
    return Math.max(0, 1 - Math.abs(t - l) / tol)
  })
  return scores.reduce((s, v) => s + v, 0) / scores.length
}

/**
 * Generates Italian feedback comparing the user's track to the average
 * features of the best-matching tracks for that specific label.
 */
function generateFeedback(
  user: Record<string, number>,
  ref: Record<string, number>
): string[] {
  const checks = [
    {
      diff: user.spectral_centroid - (ref.spectral_centroid ?? 0),
      thr: 400,
      hi: 'Il tuo mix è più brillante del sound tipico della label',
      lo: 'Il tuo mix è più dark del sound tipico della label',
    },
    {
      diff: user.spectral_rolloff - (ref.spectral_rolloff ?? 0),
      thr: 1200,
      hi: 'Le tue alte frequenze sono più presenti rispetto alla media',
      lo: 'Le tue alte frequenze sono più contenute rispetto alla media',
    },
    {
      diff: user.lufs - (ref.lufs ?? 0),
      thr: 3.0,
      hi: 'Il tuo master è più loud della media della label',
      lo: 'Il tuo master è più quiet della media della label',
    },
    {
      diff: user.zero_crossing_rate - (ref.zero_crossing_rate ?? 0),
      thr: 0.025,
      hi: 'La tua texture sonora è più ricca di transienti',
      lo: 'La tua texture sonora è più pulita e minimale',
    },
    {
      diff: user.sub_ratio - (ref.sub_ratio ?? 0),
      thr: 0.04,
      hi: 'Il tuo sound ha più sub-bass rispetto alla media della label',
      lo: 'Il tuo sound ha meno sub-bass rispetto alla media della label',
    },
    {
      diff: user.mid_presence - (ref.mid_presence ?? 0),
      thr: 0.04,
      hi: 'Le frequenze medie sono più presenti rispetto alla media della label',
      lo: 'Le frequenze medie sono più contenute rispetto alla media della label',
    },
    {
      diff: user.onset_strength - (ref.onset_strength ?? 0),
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

// ─────────────────────────────────────────────────────────────────────────────
// Background processing (runs after HTTP response is sent via after())
// ─────────────────────────────────────────────────────────────────────────────

async function processSubmission(submissionId: string, fileUrl: string, trackStatus: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  try {
    // ── 1. Analyze the user's track with the worker ────────────────────────
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
    const f: Record<string, number> = workerData.features ?? workerData
    const userEmbedding: number[] = parseEmbedding(workerData.embedding ?? f.embedding)

    // ── 2. Load all analyzed label tracks (kNN candidates) ─────────────────
    const { data: dbTracks, error: tracksErr } = await supabase
      .from('label_ingestion_queue')
      .select(`
        id, label_id, audio_embedding,
        spectral_centroid, spectral_rolloff, lufs, zero_crossing_rate,
        sub_ratio, mid_presence, onset_strength, spectral_contrast
      `)
      .eq('analysis_status', 'analyzed')
      .not('audio_embedding', 'is', null)

    if (tracksErr) throw tracksErr

    // ── 3. Load label metadata + profiles (for name, genre, confidence) ────
    const [labelsRes, profilesRes] = await Promise.all([
      supabase.from('labels').select('id, name, primary_genre'),
      supabase.from('label_profiles').select('label_id, confidence_score, analyzed_tracks_count'),
    ])

    const labelMap = new Map((labelsRes.data ?? []).map((l) => [l.id, l]))
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.label_id, p]))

    // ── 4. Score every DB track against the user's track ──────────────────
    type ScoredTrack = {
      label_id: string
      score: number
      features: Record<string, number | null>
    }

    const scoredTracks: ScoredTrack[] = (dbTracks ?? []).map((dbTrack) => {
      const dbEmbedding = parseEmbedding(dbTrack.audio_embedding)
      const rawCosine = dbEmbedding.length > 0
        ? cosineSimilarity(userEmbedding, dbEmbedding)
        : 0
      // Audio embeddings naturally cluster in [0.5, 1] → rescale to [0, 1]
      const cosine = Math.max(0, (rawCosine - 0.5) / 0.5)
      const feat = trackFeatureSimilarity(f, dbTrack as Record<string, number | null>)
      const score = cosine * 0.6 + feat * 0.4

      return {
        label_id: dbTrack.label_id,
        score,
        features: dbTrack as Record<string, number | null>,
      }
    })

    // ── 5. Group scored tracks by label ───────────────────────────────────
    const byLabel = new Map<string, ScoredTrack[]>()
    for (const st of scoredTracks) {
      if (!byLabel.has(st.label_id)) byLabel.set(st.label_id, [])
      byLabel.get(st.label_id)!.push(st)
    }

    // ── 6. Aggregate per-label score ──────────────────────────────────────
    const FEATURE_KEYS = [
      'spectral_centroid', 'spectral_rolloff', 'lufs', 'zero_crossing_rate',
      'sub_ratio', 'mid_presence', 'onset_strength', 'spectral_contrast',
    ] as const

    const matchResults: {
      label_id: string
      label_name: string
      primary_genre: string
      score: number
      confidence_score: number
      analyzed_tracks_count: number
      matched_tracks: number
      feedback: string[]
    }[] = []

    for (const [labelId, tracks] of byLabel.entries()) {
      const labelMeta = labelMap.get(labelId)
      if (!labelMeta) continue

      const profile = profileMap.get(labelId)
      const totalAnalyzed = profile?.analyzed_tracks_count ?? tracks.length
      if (totalAnalyzed < MIN_LABEL_TRACKS) continue

      // Sort by score, take top-K for quality average
      const sorted = [...tracks].sort((a, b) => b.score - a.score)
      const topK = sorted.slice(0, TOP_K_PER_LABEL)

      const avgScore = topK.reduce((s, t) => s + t.score, 0) / topK.length

      // Coverage weight: rewards labels with many genuinely similar tracks
      // Formula: 1 - e^(-n/3) → 0 for n=0, ~0.28 for n=1, ~0.63 for n=3, ~0.96 for n=10
      const goodMatchCount = tracks.filter((t) => t.score >= GOOD_MATCH_THRESHOLD).length
      const coverageWeight = 1 - Math.exp(-goodMatchCount / 3)

      // Confidence boost: rewards labels with more analyzed tracks (data quality)
      const confBoost = (profile?.confidence_score ?? 0) * 0.10

      // Final score: quality × consistency + data quality bonus
      const finalScore = avgScore * (0.7 + 0.3 * coverageWeight) + confBoost

      // Compute average features of top-K tracks for feedback generation
      const refAvg: Record<string, number> = {}
      for (const key of FEATURE_KEYS) {
        const vals = topK
          .map((t) => t.features[key])
          .filter((v): v is number => typeof v === 'number' && !isNaN(v))
        refAvg[key] = vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
      }

      matchResults.push({
        label_id: labelId,
        label_name: labelMeta.name,
        primary_genre: labelMeta.primary_genre ?? '',
        score: Math.round(finalScore * 1000) / 1000,
        confidence_score: profile?.confidence_score ?? 0,
        analyzed_tracks_count: totalAnalyzed,
        matched_tracks: goodMatchCount,
        feedback: generateFeedback(f, refAvg),
      })
    }

    const top5 = matchResults.sort((a, b) => b.score - a.score).slice(0, 5)

    // ── 7. Persist results ────────────────────────────────────────────────
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
        audio_embedding: userEmbedding,
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

// ─────────────────────────────────────────────────────────────────────────────
// HTTP handler
// ─────────────────────────────────────────────────────────────────────────────

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
