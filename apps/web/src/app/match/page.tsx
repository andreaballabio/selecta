'use client'

import { useState, useEffect, useRef } from 'react'
import { AudioUpload } from '@/components/upload/audio-upload'
import { ReportPro } from '@/components/report/report-pro'
import { DemoScore } from '@/components/report/demo-score'
import { ReferenceComparison } from '@/components/reference/reference-comparison'
import { PublishToCatalog } from '@/components/catalog/publish-to-catalog'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Music,
  RotateCcw,
  IdCard,
} from 'lucide-react'

type PageStatus = 'idle' | 'analyzing' | 'done' | 'failed'

/**
 * Memorizza l'id dell'analisi (anche se fatta da anonimo) nel localStorage, così
 * dopo un eventuale login la Dashboard può "reclamarla" e collegarla all'account.
 */
const PENDING_KEY = 'selecta:pending_submissions'
function rememberPendingSubmission(id: string) {
  if (typeof window === 'undefined' || !id) return
  try {
    const raw = window.localStorage.getItem(PENDING_KEY)
    const ids: string[] = raw ? JSON.parse(raw) : []
    if (!ids.includes(id)) ids.push(id)
    window.localStorage.setItem(PENDING_KEY, JSON.stringify(ids.slice(-50)))
  } catch { /* localStorage non disponibile */ }
}

interface MatchResult {
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
  ref_features?: Record<string, number>
}

interface TrackFeatures {
  bpm: number | null
  key: string | null
  scale: string | null
  lufs: number | null
  duration: number | null
  energy: number | null
  onset_strength: number | null
  sub_ratio: number | null
  mid_presence: number | null
  spectral_contrast: number | null
  spectral_centroid: number | null
  spectral_rolloff: number | null
  zero_crossing_rate: number | null
  tempo_stability: number | null
}

export default function MatchPage() {
  const [pageStatus, setPageStatus] = useState<PageStatus>('idle')
  const [uploadedFile, setUploadedFile] = useState<{ path: string; name: string; size: number } | null>(null)
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [trackStatus, setTrackStatus] = useState('unknown')
  const [submissionId, setSubmissionId] = useState<string | null>(null)
  const [results, setResults] = useState<MatchResult[]>([])
  const [trackFeatures, setTrackFeatures] = useState<TrackFeatures | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const supabase = createClient()

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  const handleUploadComplete = (path: string, name: string, size: number) => {
    setUploadedFile({ path, name, size })
    setTitle(name.replace(/\.[^/.]+$/, ''))
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!uploadedFile) return
    setPageStatus('analyzing')
    setError(null)
    setProgress(10)
    elapsedRef.current = 0

    try {
      const { data: { publicUrl } } = supabase.storage
        .from('audio-tracks')
        .getPublicUrl(uploadedFile.path)

      const res = await fetch('/api/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_url: publicUrl,
          title: title.trim() || undefined,
          artist: artist.trim() || undefined,
          track_status: trackStatus,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Avvio analisi fallito')
      }

      const { submission_id } = await res.json()
      setSubmissionId(submission_id)
      rememberPendingSubmission(submission_id)
      setProgress(20)

      pollRef.current = setInterval(async () => {
        elapsedRef.current += 3
        // Animate progress from 20 → 90 over ~90s
        setProgress(Math.min(90, 20 + (elapsedRef.current / 90) * 70))

        const statusRes = await fetch(`/api/match/${submission_id}/status`)
        if (!statusRes.ok) return

        const data = await statusRes.json()

        if (data.status === 'analyzed') {
          clearInterval(pollRef.current!)
          setResults(data.match_results ?? [])
          setTrackFeatures(data.features ?? null)
          setProgress(100)
          setPageStatus('done')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current!)
          setError("L'analisi non è riuscita. Riprova con un altro file.")
          setPageStatus('failed')
        }
      }, 3000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore durante l\'analisi')
      setPageStatus('failed')
    }
  }

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    setPageStatus('idle')
    setUploadedFile(null)
    setTitle('')
    setArtist('')
    setTrackStatus('unknown')
    setSubmissionId(null)
    setResults([])
    setTrackFeatures(null)
    setError(null)
    setProgress(0)
    elapsedRef.current = 0
  }

  if (pageStatus === 'done') {
    return <ResultsView results={results} features={trackFeatures} submissionId={submissionId} title={title} artist={artist} onReset={handleReset} />
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">AI Matching</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-text">Trova la tua label</h1>
          <p className="mt-2 text-muted">
            Carica la tua demo e scopri le label più compatibili col tuo sound
          </p>
        </div>

        {pageStatus === 'idle' && (
          <div className="space-y-6">
            <AudioUpload
              onUploadComplete={handleUploadComplete}
              onError={(err) => setError(err)}
            />

            {uploadedFile && (
              <div className="space-y-4 rounded-xl border border-line bg-surface/50 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Titolo <span className="text-faint">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Es. Deep Dive"
                    className="w-full rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-text placeholder-faint focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Artista <span className="text-faint">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Es. John Doe"
                    className="w-full rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-text placeholder-faint focus:border-accent focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Stato della traccia
                  </label>
                  <select
                    value={trackStatus}
                    onChange={(e) => setTrackStatus(e.target.value)}
                    className="w-full rounded-lg border border-line bg-surface-2 px-4 py-2.5 text-text focus:border-accent focus:outline-none"
                  >
                    <option value="unknown">Non specificato</option>
                    <option value="demo">Demo</option>
                    <option value="mixed">Mixed</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </div>

                <button
                  onClick={handleAnalyze}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-6 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent"
                >
                  <Sparkles className="h-5 w-5" />
                  Analizza con AI
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {pageStatus === 'analyzing' && (
          <div className="rounded-xl border border-line bg-surface/50 p-8 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-accent/10 mx-auto">
              <Loader2 className="h-8 w-8 animate-spin text-accent" />
            </div>
            <p className="mb-1 text-lg font-semibold text-text">Analisi in corso...</p>
            <p className="mb-6 text-sm text-muted">
              Il worker sta estraendo le feature audio. Può richiedere fino a 90 secondi.
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-surface-2">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-faint">{Math.round(progress)}%</p>
          </div>
        )}

        {pageStatus === 'failed' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-red-400">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={handleReset}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-line px-6 py-3 font-medium text-text hover:border-faint hover:text-text"
            >
              <RotateCcw className="h-4 w-4" />
              Riprova
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ResultsView({
  results,
  features,
  submissionId,
  title,
  artist,
  onReset,
}: {
  results: MatchResult[]
  features: TrackFeatures | null
  submissionId: string | null
  title?: string
  artist?: string
  onReset: () => void
}) {
  const formatDuration = (s: number | null) => {
    if (!s) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-text">Le tue label</h1>
            <p className="text-sm text-muted">Top {results.length} match per il tuo sound</p>
          </div>
          <button
            onClick={onReset}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-line px-4 py-2 text-sm font-medium text-muted hover:border-faint hover:text-text"
          >
            <RotateCcw className="h-4 w-4" />
            Nuova analisi
          </button>
        </div>

        {/* Dati audio rilevati dalla traccia */}
        {features && (
          <div className="mb-6 rounded-xl border border-line bg-surface/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">La tua traccia</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {features.bpm != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{Math.round(features.bpm)}</p>
                  <p className="text-xs text-faint">BPM</p>
                </div>
              )}
              {features.key && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{features.key} {features.scale ?? ''}</p>
                  <p className="text-xs text-faint">Key</p>
                </div>
              )}
              {features.lufs != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{features.lufs.toFixed(1)}</p>
                  <p className="text-xs text-faint">LUFS</p>
                </div>
              )}
              {features.duration != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{formatDuration(features.duration)}</p>
                  <p className="text-xs text-faint">Durata</p>
                </div>
              )}
              {features.sub_ratio != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{Math.round(features.sub_ratio * 100)}%</p>
                  <p className="text-xs text-faint">Sub</p>
                </div>
              )}
              {features.onset_strength != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-text">{Math.round(features.onset_strength * 100)}</p>
                  <p className="text-xs text-faint">Groove</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Demo Score — punteggio + confronto col resto delle demo */}
        {submissionId && (
          <div className="mb-6">
            <DemoScore submissionId={submissionId} />
          </div>
        )}

        {/* Report PRO — analisi tecnica del proprio master */}
        {features && (
          <div className="mb-6">
            <ReportPro features={features} />
          </div>
        )}

        {/* Reference Matching — confronto col miglior match */}
        {features && results[0]?.ref_features && (
          <div className="mb-6">
            <ReferenceComparison
              user={features as unknown as Record<string, number | null>}
              labelAvg={results[0].ref_features}
              labelName={results[0].label_name}
            />
          </div>
        )}

        <div className="space-y-4">
          {results.map((result, index) => {
            const displayScore = Math.min(100, Math.round(result.score * 100))
            const isTop = index === 0
            return (
              <div
                key={result.label_id}
                className={`rounded-xl border p-6 ${
                  isTop
                    ? 'border-accent/40 bg-surface-2'
                    : 'border-line bg-surface/50'
                }`}
              >
                {/* Header */}
                <div className="mb-4 flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        isTop ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div>
                      <h3 className="font-semibold text-text">{result.label_name}</h3>
                      {result.primary_genre && (
                        <p className="text-xs text-muted">{result.primary_genre}</p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-2xl font-bold ${isTop ? 'text-accent' : 'text-text'}`}>
                      {displayScore}%
                    </p>
                    <div className="mt-1 flex flex-col items-end gap-1">
                      <ConfidenceBadge score={result.confidence_score} />
                    </div>
                  </div>
                </div>

                {/* Score bar */}
                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={`h-full rounded-full ${isTop ? 'bg-accent' : 'bg-faint'}`}
                    style={{ width: `${displayScore}%` }}
                  />
                </div>

                {/* Traccia più simile trovata */}
                {result.best_track_title && (
                  <div className={`mb-3 rounded-lg px-3 py-2 text-sm ${
                    isTop ? 'bg-surface-2 border border-accent/30' : 'bg-surface-2/60'
                  }`}>
                    <span className="text-muted">Traccia più simile: </span>
                    <span className="font-medium text-text">
                      {result.best_track_artist ? `${result.best_track_artist} — ` : ''}
                      {result.best_track_title}
                    </span>
                    <span className={`ml-2 font-semibold ${isTop ? 'text-accent' : 'text-muted'}`}>
                      {result.best_track_score}%
                    </span>
                  </div>
                )}

                {/* Badge contesto */}
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {result.match_context.includes('exact_match') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      ✦ Traccia quasi identica nel catalogo
                    </span>
                  )}
                  {result.match_context.includes('strong_isolated') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-400">
                      ⚠ Match forte su traccia singola — verifica il catalogo
                    </span>
                  )}
                  {result.match_context.includes('consistent') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/15 px-2 py-0.5 text-xs text-blue-400">
                      ◆ Stile coerente con {result.good_matches} tracce del catalogo
                    </span>
                  )}
                  {result.match_context.includes('sparse') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-faint/50 px-2 py-0.5 text-xs text-muted">
                      Poche tracce corrispondenti
                    </span>
                  )}
                  {result.match_context.length === 0 && result.good_matches > 0 && (
                    <span className="text-xs text-faint">
                      {result.good_matches} tracce simili su {result.analyzed_tracks_count}
                    </span>
                  )}
                </div>

                {/* Feedback */}
                <ul className="space-y-1.5">
                  {result.feedback.map((line, i) => (
                    <li key={i} className="flex gap-2 text-sm text-muted">
                      <span className="shrink-0 text-faint">—</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        {/* Pubblica nel catalogo (Fase 0 — vetrina curata) */}
        {submissionId && (
          <div className="mt-8">
            <PublishToCatalog submissionId={submissionId} defaultTitle={title} defaultArtist={artist} />
          </div>
        )}

        {/* Funnel: dall'analisi alla tua identità condivisibile */}
        <div className="mt-8 rounded-2xl border border-accent/20 bg-surface-2 p-6 text-center">
          <h3 className="text-lg font-semibold text-text">Trasforma il tuo sound in una Press Kit</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Una pagina condivisibile, auto-popolata dalle tue analisi, da mandare a locali, PR e label.
          </p>
          <Link href="/profile" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 font-semibold text-accent-ink transition-colors hover:bg-accent">
            <IdCard className="h-4 w-4" /> Crea la tua Press Kit
          </Link>
        </div>

        {submissionId && (
          <p className="mt-6 text-center text-xs text-faint">ID analisi: {submissionId}</p>
        )}
      </div>
    </div>
  )
}


function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 0.6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
        <CheckCircle className="h-3 w-3" />
        Profilo solido
      </span>
    )
  }
  if (score < 0.3) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
        <Music className="h-3 w-3" />
        Profilo in costruzione
      </span>
    )
  }
  return null
}
