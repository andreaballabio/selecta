import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

// ─── Tuning parameters ───────────────────────────────────────────────────────
const MIN_LABEL_TRACKS    = 3
const TOP_K_PER_LABEL     = 10
/**
 * Soglia per contare una traccia come "buon match" (badge / contesto).
 * NON influenza il ranking — usata solo per i badge informativi.
 * Calibrata su rawCosine diretto: 0.90 separa "davvero simile"
 * da "stesso genere ma diversa".
 */
const GOOD_MATCH_THRESHOLD = 0.90
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

/** Sliding window: usa il MAX di similarità coseno su tutte le finestre
 *  dell'utente contro l'embedding del catalogo.
 *  Risponde a "esiste almeno una sezione di 30s della tua traccia
 *  che suona come questa traccia del catalogo?" */
function maxCosineSimilarity(userEmbeddings: number[][], catalogEmbedding: number[]): number {
  if (userEmbeddings.length === 0) return 0
  return Math.max(...userEmbeddings.map(e => cosineSimilarity(e, catalogEmbedding)))
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
    const workerFeatures = workerData.features ?? workerData
    const f: Record<string, number> = workerFeatures as Record<string, number>

    // Embedding singolo (fallback)
    const userEmbedding: number[] = parseEmbedding(workerFeatures.embedding)

    // Sliding-window embeddings (tracce intere): ogni finestra da 30s confrontata
    // direttamente con le preview del catalogo → max cosine similarity
    const rawEmbeddings = workerFeatures.embeddings
    const userEmbeddings: number[][] =
      Array.isArray(rawEmbeddings) && rawEmbeddings.length > 0
        ? (rawEmbeddings as unknown[]).map(e => parseEmbedding(e))
        : [userEmbedding]

    // ── 2. Load all analyzed label tracks (kNN candidates) ─────────────────
    const { data: dbTracks, error: tracksErr } = await supabase
      .from('label_ingestion_queue')
      .select(`
        id, label_id, audio_embedding,
        track_title, artist_name,
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
      track_title: string | null
      artist_name: string | null
    }

    // ── Debug: quante finestre sliding-window ha il worker restituito? ────────
    console.log(
      `[match] userEmbeddings=${userEmbeddings.length} windows | ` +
      `catalogTracks=${(dbTracks ?? []).length}`
    )

    const scoredTracks: ScoredTrack[] = (dbTracks ?? []).map((dbTrack) => {
      const dbEmbedding = parseEmbedding(dbTrack.audio_embedding)
      // MAX cosine su tutte le finestre sliding-window → "drop contro drop".
      // NON mischiamo con trackFeatureSimilarity: quella confronta feature medie
      // del full track (6 min incluso intro) con feature del preview di 30s (solo drop),
      // due contesti diversi → introduce rumore che penalizza la traccia corretta.
      // Tutte le feature stilistiche (MFCC, centroid, sub, mid, onset) sono già
      // codificate nell'embedding → il cosine cattura tutto ciò che serve.
      const score = dbEmbedding.length > 0
        ? maxCosineSimilarity(userEmbeddings, dbEmbedding)
        : 0

      return {
        label_id: dbTrack.label_id,
        score,
        features: dbTrack as Record<string, number | null>,
        track_title: (dbTrack as Record<string, unknown>).track_title as string | null ?? null,
        artist_name: (dbTrack as Record<string, unknown>).artist_name as string | null ?? null,
      }
    })

    // ── Debug: distribuzione dei punteggi (utile per calibrare soglie) ────────
    {
      const allScores = scoredTracks.map(t => t.score).sort((a, b) => b - a)
      const p = (pct: number) => allScores[Math.floor(allScores.length * pct)]?.toFixed(3) ?? 'n/a'
      console.log(
        `[match] score distribution: max=${p(0)} p10=${p(0.1)} p25=${p(0.25)} ` +
        `median=${p(0.5)} p75=${p(0.75)} min=${p(1)}`
      )
      const topTracks = scoredTracks
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map(t => `${labelMap.get(t.label_id)?.name ?? t.label_id}/${t.track_title ?? '?'}=${t.score.toFixed(3)}`)
      console.log(`[match] top5 tracks: ${topTracks.join(' | ')}`)
    }

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
      good_matches: number
      best_track_title: string | null
      best_track_artist: string | null
      best_track_score: number
      match_context: string[]
      feedback: string[]
    }[] = []

    for (const [labelId, tracks] of byLabel.entries()) {
      const labelMeta = labelMap.get(labelId)
      if (!labelMeta) continue

      const profile = profileMap.get(labelId)
      if (tracks.length < MIN_LABEL_TRACKS) continue

      const sorted = [...tracks].sort((a, b) => b.score - a.score)
      const topK = sorted.slice(0, TOP_K_PER_LABEL)

      // ── Score ─────────────────────────────────────────────────────────────

      const bestTrack = sorted[0]
      const bestScore = bestTrack?.score ?? 0

      // Media del topK (usata come tiebreaker e per badge, NON come componente
      // primaria — altrimenti label con molte tracce mediocri battono quella
      // con UNA traccia identica).
      const topKScores = topK.map(t => t.score)
      const topKMean = topKScores.reduce((s, v) => s + v, 0) / topKScores.length

      // Punteggio = cubo di bestScore  (+ piccoli bonus per tiebreaker)
      //
      // Il cubo amplifica le differenze nel range stretto [0.88, 1.0]
      // senza overflow, nessun moltiplicatore che fa esplodere tutto a 100%.
      // Risultati tipici (stessa label):
      //   0.99^3 = 0.970  ← traccia quasi identica
      //   0.97^3 = 0.913  ← match molto forte
      //   0.95^3 = 0.857  ← match buono
      //   0.90^3 = 0.729  ← stessa vibe
      //   0.85^3 = 0.614  ← generico
      //
      // Garantisce che UNA traccia a 0.97 batta SEMPRE label con molte
      // tracce a 0.93, qualunque sia la dimensione del catalogo.
      //
      // + 5% topKMean  → tiebreaker: label con stile coerente su più tracce
      // + 2% confidence → affidabilità del profilo label
      const finalScore =
        Math.pow(bestScore, 3) +
        topKMean * 0.05 +
        (profile?.confidence_score ?? 0) * 0.02

      // Per i badge informativi (non influenzano il ranking)
      const goodMatchCount = tracks.filter(t => t.score >= GOOD_MATCH_THRESHOLD).length
      const stdTopK = Math.sqrt(topKScores.reduce((s, v) => s + (v - topKMean) ** 2, 0) / topKScores.length)
      const consistency = topKMean > 0 ? Math.max(0, 1 - stdTopK / topKMean) : 0

      // ── Contesto del match (mostrato all'utente) ─────────────────────────
      // Soglie calibrate su rawCosine diretto (non riscalato).
      const match_context: string[] = []
      if (bestScore > 0.93)
        match_context.push('exact_match')       // traccia quasi identica trovata
      else if (bestScore > 0.88 && goodMatchCount < 3)
        match_context.push('strong_isolated')   // match forte ma su poche tracce
      if (goodMatchCount >= 3 && consistency >= 0.65)
        match_context.push('consistent')        // stile coerente con il catalogo
      if (goodMatchCount < 2 && tracks.length >= 8)
        match_context.push('sparse')            // poche tracce corrispondenti

      // ── Feature medie dei top-K per generare il feedback ─────────────────
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
        analyzed_tracks_count: tracks.length,
        good_matches: goodMatchCount,
        best_track_title: bestTrack?.track_title ?? null,
        best_track_artist: bestTrack?.artist_name ?? null,
        best_track_score: Math.round(bestScore * 100),
        match_context,
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
