import { after } from 'next/server'
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { pickVersionSubset } from '@/lib/embedding-version'

const WORKER_URL = process.env.WORKER_URL || 'https://andreaballabio-selecta-worker.hf.space'

// ─── Tuning parameters ───────────────────────────────────────────────────────
const MIN_LABEL_TRACKS    = 3
const TOP_K_PER_LABEL     = 10

/**
 * Mappatura ASSOLUTA similarità → percentuale (NON relativa al set di risultati).
 * Il ranking dipende SOLO dalla similarità grezza; questi valori cambiano solo
 * la % MOSTRATA, mai l'ordine delle label.
 *
 * CEIL = livello "match perfetto / quasi-duplicato": proprietà dell'embedding
 * EffNet (stabile; si ritocca solo se si cambia il modello).
 * FLOOR (lo 0%) è AUTO-CALIBRATO dal catalogo a ogni match (autoCalibrateFloor)
 * → si adatta da solo quando aggiungi label/tracce.
 */
const COSINE_CEIL    = 0.88
// FLOOR = median + FRACTION·(p97 − median) delle similarità fra tracce DIVERSE.
// Robusto alla forma della distribuzione: con EffNet le tracce diverse sono
// ~scorrelate (mediana ~0); il p97 è "le diverse più simili". FLOOR si colloca
// a metà strada → si adatta al catalogo senza dipendere da un percentile fragile.
const FLOOR_FRACTION = 0.45
const FLOOR_FALLBACK = 0.20      // catalogo troppo piccolo per stimarlo
const FLOOR_MIN      = 0.10      // guardrail inferiore

/** Soglie di contesto/badge (livelli assoluti dell'embedding) — NON ranking. */
const GOOD_MATCH_THRESHOLD = 0.45   // "buon match" per i conteggi
const EXACT_MATCH_COSINE   = 0.75   // traccia quasi identica (stessa registrazione)
const STRONG_MATCH_COSINE  = 0.55   // match di stile forte

// ─── Peso temporale (favorisce il SUONO ATTUALE della label) ──────────────────
// I trend cambiano in fretta: pesiamo ogni uscita per "freschezza" così il match
// riflette dove la label è ADESSO, non la media di tutta la sua storia. Resta
// ASSOLUTO (nessuna normalizzazione fra label) e lavora sull'embedding timbrico
// (niente BPM/key). Disattivabile con RECENCY_ENABLED=false → torna al best-match
// puro di prima.
const RECENCY_ENABLED  = true
const RECENCY_HALFLIFE = 1.3   // anni: un'uscita DIMEZZA il suo peso ogni ~1.3 anni
                               //   0a→1.0  1a→0.59  2a→0.34  3a→0.20  5a→0.07
const RECENCY_FLOOR    = 0.12  // peso minimo: il passato conta poco ma non sparisce
const STYLE_WEIGHT     = 0.45  // quanto pesa "suono attuale" vs "miglior match assoluto"
const RECENT_AGE_MAX   = 1.5   // anni: best match "in linea col suono attuale"
const LEGACY_AGE_MIN   = 3.0   // anni: best match dalla "fase vecchia" della label
const NOW_MS = Date.now()

/** Età in ANNI dalla data di uscita = (oggi − data)/365.25 giorni. È un anno a
 *  ritroso CONTINUO che scala ogni giorno (NON l'anno solare). Se manca la data
 *  piena uso l'anno con ancora a metà anno (1 luglio) → resta comunque rolling.
 *  null se la data è del tutto sconosciuta. */
const YEAR_MS = 365.25 * 24 * 3600 * 1000
function ageYears(releaseDate: string | null, releaseYear: number | null): number | null {
  if (releaseDate) {
    const t = Date.parse(releaseDate)
    if (!isNaN(t)) return Math.max(0, (NOW_MS - t) / YEAR_MS)
  }
  if (releaseYear && releaseYear > 1900)
    return Math.max(0, (NOW_MS - Date.UTC(releaseYear, 6, 1)) / YEAR_MS)
  return null
}
/** Peso a decadimento esponenziale; `fallback` per le tracce senza data. */
function recencyWeight(age: number | null, fallback: number): number {
  if (age == null) return fallback
  return Math.max(RECENCY_FLOOR, Math.pow(0.5, age / RECENCY_HALFLIFE))
}
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Forza del match in [0,1] — mappatura assoluta e monotona, SENZA normalizzazione
 * relativa fra label. `floor` è auto-calibrato dal catalogo (vedi sotto).
 */
function matchStrength(cosine: number, floor: number): number {
  const t = (cosine - floor) / (COSINE_CEIL - floor)
  return Math.max(0, Math.min(1, t))
}

/**
 * AUTO-CALIBRAZIONE del FLOOR (lo 0%) = "livello base" di similarità fra tracce
 * DIVERSE del catalogo. Deterministico (stesso catalogo → stesso valore, niente
 * jitter fra match), ricalcolato a ogni match → si adatta quando aggiungi
 * label/tracce. Resta ASSOLUTO: dipende SOLO dal catalogo, non dalle label nel
 * risultato del singolo utente.
 *   FLOOR = mediana + 45%·(p97 − mediana) delle cosine fra coppie di tracce
 *   diverse (mean-centered). La mediana è il "centro" (≈0 con EffNet: tracce
 *   diverse scorrelate), il p97 è "le diverse più simili"; il FLOOR sta a metà
 *   strada → un match reale deve battere chiaramente il rumore di fondo.
 */
function autoCalibrateFloor(centeredCatalog: number[][]): number {
  const n = centeredCatalog.length
  if (n < 12) return FLOOR_FALLBACK                  // troppo poche → default stabile
  // sottoinsieme DETERMINISTICO (max 150, equispaziato): O(1), nessuna casualità
  let sample = centeredCatalog
  if (n > 150) {
    const step = n / 150
    sample = Array.from({ length: 150 }, (_, k) => centeredCatalog[Math.floor(k * step)])
  }
  const sims: number[] = []
  for (let i = 0; i < sample.length; i++)
    for (let j = i + 1; j < sample.length; j++)
      sims.push(cosineSimilarity(sample[i], sample[j]))
  if (sims.length === 0) return FLOOR_FALLBACK
  sims.sort((a, b) => a - b)
  const med = sims[Math.floor(sims.length * 0.50)]
  const hi  = sims[Math.min(sims.length - 1, Math.floor(sims.length * 0.97))]
  const floor = Math.max(FLOOR_MIN, Math.min(med + FLOOR_FRACTION * (hi - med), COSINE_CEIL - 0.20))
  console.log(`[match] autoFloor=${floor.toFixed(3)} (median=${med.toFixed(3)} p97=${hi.toFixed(3)} pairs=${sims.length})`)
  return floor
}

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

/** Sliding window: aggrega la similarità coseno fra le finestre da 30s della
 *  traccia utente e l'embedding (preview ~30s) del catalogo.
 *
 *  NON usiamo il MAX puro: con ~70 finestre, per QUALSIASI traccia del catalogo
 *  esiste una finestra che combacia per caso → tutto si gonfia a ~1.0 (tutte le
 *  label al 100%). La traccia ESATTA invece combacia su PIÙ finestre consecutive
 *  (lo stesso drop ricade in più finestre sovrapposte da 30s/stride 5s). Quindi
 *  usiamo la MEDIA delle migliori K finestre: la traccia esatta resta ~1.0,
 *  mentre una somiglianza fortuita su UNA sola finestra viene diluita → il
 *  distacco fra "stesso pezzo" e "stesso genere" aumenta. */
const TOP_K_WINDOWS = 5
function windowMatchScore(userEmbeddings: number[][], catalogEmbedding: number[]): number {
  if (userEmbeddings.length === 0) return 0
  const sims = userEmbeddings
    .map(e => cosineSimilarity(e, catalogEmbedding))
    .sort((a, b) => b - a)
  const k = Math.min(TOP_K_WINDOWS, sims.length)
  let s = 0
  for (let i = 0; i < k; i++) s += sims[i]
  return s / k
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
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
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

    // Versione dello spazio embedding del worker (effnet / v6 / librosa).
    const userVersion: string | null =
      typeof workerFeatures.embedding_version === 'string' ? workerFeatures.embedding_version : null

    // ── 2. Load all analyzed label tracks (kNN candidates) ─────────────────
    type DbTrack = Record<string, unknown> & {
      id: string; label_id: string; audio_embedding: unknown
      track_title: string | null; artist_name: string | null
      release_date: string | null; release_year: number | null
      embedding_version?: string | null
    }
    const COLS =
      'id, label_id, audio_embedding, track_title, artist_name, release_date, release_year, ' +
      'spectral_centroid, spectral_rolloff, lufs, zero_crossing_rate, sub_ratio, mid_presence, onset_strength, spectral_contrast'
    // Select con `embedding_version`; se la colonna non esiste ancora (pre-migrazione)
    // si ricade sul set base → niente si rompe.
    const sel = (cols: string) =>
      supabase.from('label_ingestion_queue').select(cols)
        .eq('analysis_status', 'analyzed').not('audio_embedding', 'is', null)
    let dbRes = await sel(`${COLS}, embedding_version`)
    if (dbRes.error) dbRes = await sel(COLS)
    if (dbRes.error) throw dbRes.error

    // Guard versione: confronta solo vettori dello STESSO spazio embedding.
    // No-op se il catalogo è single-version o non taggato (caso attuale).
    const { subset: dbTracks, mixed: catalogMixed } =
      pickVersionSubset((dbRes.data ?? []) as unknown as DbTrack[], userVersion)
    if (catalogMixed)
      console.warn('[match] catalogo embedding MISTO → confronto ristretto a una versione (rianalizza per uniformare)')

    // ── 3. Load label metadata + profiles (for name, genre, confidence) ────
    const [labelsRes, profilesRes] = await Promise.all([
      supabase.from('labels').select('id, name, primary_genre'),
      supabase.from('label_profiles').select('label_id, confidence_score, analyzed_tracks_count'),
    ])

    const labelMap = new Map((labelsRes.data ?? []).map((l) => [l.id, l]))
    const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.label_id, p]))

    // ── Mean-centering ─────────────────────────────────────────────────────
    // Tutte le tracce techno condividono una "traccia media" comune (embedding
    // tutto positivo → cosine alto a prescindere, tutto al ~100%). Sottraendo la
    // media del catalogo da OGNI vettore (catalogo + finestre utente) resta solo
    // CIÒ CHE DISTINGUE ogni traccia. Il cosine su vettori centrati è la
    // correlazione di Pearson: molto più discriminante in un catalogo omogeneo.
    const EMB_DIM = 64
    const catEmbeddings = (dbTracks ?? [])
      .map((t) => parseEmbedding(t.audio_embedding))
      .filter((e) => e.length === EMB_DIM)
    const meanEmbedding = new Array(EMB_DIM).fill(0)
    if (catEmbeddings.length > 0) {
      for (const e of catEmbeddings)
        for (let i = 0; i < EMB_DIM; i++) meanEmbedding[i] += e[i] ?? 0
      for (let i = 0; i < EMB_DIM; i++) meanEmbedding[i] /= catEmbeddings.length
    }
    const center = (v: number[]): number[] =>
      v.length === EMB_DIM ? v.map((x, i) => x - meanEmbedding[i]) : v
    const centeredUserEmbeddings = userEmbeddings.map(center)

    // Auto-calibrazione del FLOOR dal catalogo corrente (deterministica, stabile).
    const centeredCatalog = catEmbeddings.map(center)
    const cosineFloor = autoCalibrateFloor(centeredCatalog)

    // ── 4. Score every DB track against the user's track ──────────────────
    type ScoredTrack = {
      label_id: string
      score: number
      features: Record<string, number | null>
      track_title: string | null
      artist_name: string | null
      release_date: string | null
      release_year: number | null
    }

    // ── Debug: quante finestre sliding-window ha il worker restituito? ────────
    console.log(
      `[match] userEmbeddings=${userEmbeddings.length} windows | ` +
      `catalogTracks=${(dbTracks ?? []).length}`
    )

    const scoredTracks: ScoredTrack[] = (dbTracks ?? []).map((dbTrack) => {
      const dbEmbedding = parseEmbedding(dbTrack.audio_embedding)
      // Media top-K finestre su embedding MEAN-CENTERED (≈ Pearson): "drop vs
      // drop" ma dopo aver tolto la "traccia media" del catalogo → la traccia
      // esatta resta vicina a 1.0, le tracce diverse scendono davvero.
      const score = dbEmbedding.length > 0
        ? windowMatchScore(centeredUserEmbeddings, center(dbEmbedding))
        : 0

      return {
        label_id: dbTrack.label_id,
        score,
        features: dbTrack as Record<string, number | null>,
        track_title: (dbTrack as Record<string, unknown>).track_title as string | null ?? null,
        artist_name: (dbTrack as Record<string, unknown>).artist_name as string | null ?? null,
        release_date: (dbTrack as Record<string, unknown>).release_date as string | null ?? null,
        release_year: (dbTrack as Record<string, unknown>).release_year as number | null ?? null,
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
      ref_features: Record<string, number>
    }[] = []

    for (const [labelId, tracks] of byLabel.entries()) {
      const labelMeta = labelMap.get(labelId)
      if (!labelMeta) continue

      const profile = profileMap.get(labelId)
      if (tracks.length < MIN_LABEL_TRACKS) continue

      const sorted = [...tracks].sort((a, b) => b.score - a.score)
      const topK = sorted.slice(0, TOP_K_PER_LABEL)

      // ── Peso temporale per traccia ────────────────────────────────────────
      // Le tracce SENZA data prendono il peso MEDIANO delle tracce datate della
      // label (= "una traccia tipica di questa label"), così un'uscita senza
      // data non domina né viene azzerata. Re-importando da Deezer le date ci
      // sono → il fallback diventa marginale.
      const ages = new Map(tracks.map(t => [t, ageYears(t.release_date, t.release_year)]))
      const datedW = tracks.map(t => ages.get(t)!).filter((a): a is number => a != null)
                           .map(a => recencyWeight(a, 0))
      const medianW = datedW.length
        ? [...datedW].sort((a, b) => a - b)[Math.floor(datedW.length / 2)]
        : 0.5
      const wOf = (t: ScoredTrack) => recencyWeight(ages.get(t) ?? null, medianW)

      // ── Score ─────────────────────────────────────────────────────────────
      // Due segnali combinati:
      //   • EVIDENZA (date-agnostica): il MIGLIOR match singolo → una label con
      //     UNA traccia quasi identica vince comunque (anche se vecchia).
      //   • SUONO ATTUALE: media dei top-K pesata per freschezza → premia chi
      //     è in linea con la direzione RECENTE della label.
      // matchStrength() converte il cosine grezzo in percentuale assoluta.

      const bestTrack = sorted[0]
      const bestCosine = bestTrack?.score ?? 0   // cosine grezzo [~0.7, 1.0]

      // Media del topK (tiebreaker + badge, NON componente primaria).
      const topKScores = topK.map(t => t.score)
      const topKMean = topKScores.reduce((s, v) => s + v, 0) / topKScores.length

      const bestEvidence = matchStrength(bestCosine, cosineFloor)

      // % mostrata = mix fra evidenza assoluta e fit col suono attuale.
      let displayStrength = bestEvidence
      if (RECENCY_ENABLED) {
        const wsum = topK.reduce((s, t) => s + wOf(t), 0)
        const currentCosine = wsum > 0
          ? topK.reduce((s, t) => s + t.score * wOf(t), 0) / wsum
          : topKMean
        const styleStrength = matchStrength(currentCosine, cosineFloor)
        displayStrength = STYLE_WEIGHT * styleStrength + (1 - STYLE_WEIGHT) * bestEvidence
        // Salvaguardia: un quasi-duplicato resta un segnale forte a prescindere
        // dall'età → la recency non può affossarlo sotto il 90% della sua evidenza.
        if (bestCosine > EXACT_MATCH_COSINE)
          displayStrength = Math.max(displayStrength, bestEvidence * 0.9)
      }

      // I tiebreaker (coerenza su più tracce, confidence del profilo) sono
      // INFINITESIMI: rompono i pari-merito nell'ordinamento senza spostare la
      // percentuale visibile (round a 2 cifre invariato).
      const finalScore =
        displayStrength +
        topKMean * 0.001 +
        (profile?.confidence_score ?? 0) * 0.0005

      // Per i badge informativi (non influenzano il ranking)
      const goodMatchCount = tracks.filter(t => t.score >= GOOD_MATCH_THRESHOLD).length
      const stdTopK = Math.sqrt(topKScores.reduce((s, v) => s + (v - topKMean) ** 2, 0) / topKScores.length)
      const consistency = topKMean > 0 ? Math.max(0, 1 - stdTopK / topKMean) : 0

      // ── Contesto del match (mostrato all'utente) ─────────────────────────
      // Soglie su cosine grezzo embedding v6 (vedi costanti in alto).
      const match_context: string[] = []
      if (bestCosine > EXACT_MATCH_COSINE)
        match_context.push('exact_match')       // traccia quasi identica trovata
      else if (bestCosine > STRONG_MATCH_COSINE && goodMatchCount < 3)
        match_context.push('strong_isolated')   // match forte ma su poche tracce
      if (goodMatchCount >= 3 && consistency >= 0.65)
        match_context.push('consistent')        // stile coerente con il catalogo
      if (goodMatchCount < 2 && tracks.length >= 8)
        match_context.push('sparse')            // poche tracce corrispondenti

      // ── Evoluzione: il miglior match è recente o di una fase passata? ─────
      const bestAge = ages.get(bestTrack)
      if (RECENCY_ENABLED && bestCosine > STRONG_MATCH_COSINE && bestAge != null) {
        if (bestAge <= RECENT_AGE_MAX)
          match_context.push('current_sound')   // in linea con la direzione ATTUALE
        else if (bestAge >= LEGACY_AGE_MIN)
          match_context.push('legacy_match')     // ricorda la loro fase più vecchia
      }

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
        best_track_score: Math.round(displayStrength * 100),
        match_context,
        feedback: generateFeedback(f, refAvg),
        ref_features: refAvg,
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

    // Best-effort: salva i campi "nuovi" (versione embedding + check tecnici).
    // Update separato che ignora l'errore se le colonne non esistono ancora
    // (pre-migrazioni 0014/0016) → non blocca mai il match.
    const extras: Record<string, unknown> = {}
    if (userVersion) extras.embedding_version = userVersion
    for (const k of ['true_peak_dbtp', 'crest_db', 'stereo_correlation', 'loopiness', 'intro_build'] as const) {
      const v = (workerFeatures as Record<string, unknown>)[k]
      if (typeof v === 'number' && !Number.isNaN(v)) extras[k] = v
    }
    if (Object.keys(extras).length > 0) {
      const vr = await supabase.from('user_submissions').update(extras).eq('id', submissionId)
      if (vr.error) console.warn('[match] campi extra non salvati (migrazioni 0014/0016?):', vr.error.message)
    }

  } catch (err) {
    console.error('[match] processing error:', err)
    await createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
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
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!
  )

  // Utente loggato (opzionale): lega l'analisi al suo account → la Press Kit si
  // auto-popola col suo sound DNA. L'analisi anonima resta possibile (gancio gratis).
  let userId: string | null = null
  try {
    const ssr = await createSsrClient()
    const { data: { user } } = await ssr.auth.getUser()
    userId = user?.id ?? null
  } catch { /* anonimo */ }

  const { data: submission, error } = await supabase
    .from('user_submissions')
    .insert({
      file_url,
      title: title ?? null,
      artist: artist ?? null,
      track_status,
      analysis_status: 'analyzing',
      user_id: userId,
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
