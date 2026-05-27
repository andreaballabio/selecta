'use client'

import { useState, useEffect, useRef } from 'react'
import { AudioUpload } from '@/components/upload/audio-upload'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Music,
  RotateCcw,
} from 'lucide-react'

type PageStatus = 'idle' | 'analyzing' | 'done' | 'failed'

interface MatchResult {
  label_id: string
  label_name: string
  primary_genre: string
  score: number
  confidence_score: number
  analyzed_tracks_count: number
  feedback: string[]
}

interface TrackFeatures {
  bpm: number | null
  key: string | null
  scale: string | null
  lufs: number | null
  duration: number | null
  onset_strength: number | null
  sub_ratio: number | null
  mid_presence: number | null
  spectral_contrast: number | null
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
    return <ResultsView results={results} features={trackFeatures} submissionId={submissionId} onReset={handleReset} />
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">AI Matching</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Trova la tua label</h1>
          <p className="mt-2 text-zinc-400">
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
              <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-950/50 p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Titolo <span className="text-zinc-600">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Es. Deep Dive"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Artista <span className="text-zinc-600">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Es. John Doe"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-zinc-300">
                    Stato della traccia
                  </label>
                  <select
                    value={trackStatus}
                    onChange={(e) => setTrackStatus(e.target.value)}
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2.5 text-white focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="unknown">Non specificato</option>
                    <option value="demo">Demo</option>
                    <option value="mixed">Mixed</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </div>

                <button
                  onClick={handleAnalyze}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black transition-colors hover:bg-emerald-400"
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
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-8 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mx-auto">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
            </div>
            <p className="mb-1 text-lg font-semibold text-white">Analisi in corso...</p>
            <p className="mb-6 text-sm text-zinc-500">
              Il worker sta estraendo le feature audio. Può richiedere fino a 90 secondi.
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-900">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-zinc-600">{Math.round(progress)}%</p>
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
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 px-6 py-3 font-medium text-zinc-300 hover:border-zinc-700 hover:text-white"
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
  onReset,
}: {
  results: MatchResult[]
  features: TrackFeatures | null
  submissionId: string | null
  onReset: () => void
}) {
  const formatDuration = (s: number | null) => {
    if (!s) return '--:--'
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Le tue label</h1>
            <p className="text-sm text-zinc-400">Top {results.length} match per il tuo sound</p>
          </div>
          <button
            onClick={onReset}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-800 px-4 py-2 text-sm font-medium text-zinc-400 hover:border-zinc-700 hover:text-white"
          >
            <RotateCcw className="h-4 w-4" />
            Nuova analisi
          </button>
        </div>

        {/* Dati audio rilevati dalla traccia */}
        {features && (
          <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-950/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">La tua traccia</p>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
              {features.bpm != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(features.bpm)}</p>
                  <p className="text-xs text-zinc-600">BPM</p>
                </div>
              )}
              {features.key && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{features.key} {features.scale ?? ''}</p>
                  <p className="text-xs text-zinc-600">Key</p>
                </div>
              )}
              {features.lufs != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{features.lufs.toFixed(1)}</p>
                  <p className="text-xs text-zinc-600">LUFS</p>
                </div>
              )}
              {features.duration != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{formatDuration(features.duration)}</p>
                  <p className="text-xs text-zinc-600">Durata</p>
                </div>
              )}
              {features.sub_ratio != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(features.sub_ratio * 100)}%</p>
                  <p className="text-xs text-zinc-600">Sub</p>
                </div>
              )}
              {features.onset_strength != null && (
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{Math.round(features.onset_strength * 100)}</p>
                  <p className="text-xs text-zinc-600">Groove</p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {results.map((result, index) => (
            <div
              key={result.label_id}
              className={`rounded-xl border p-6 ${
                index === 0
                  ? 'border-emerald-500/40 bg-emerald-950/20'
                  : 'border-zinc-800 bg-zinc-950/50'
              }`}
            >
              {/* Header */}
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      index === 0
                        ? 'bg-emerald-500 text-black'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{result.label_name}</h3>
                    {result.primary_genre && (
                      <p className="text-xs text-zinc-500">{result.primary_genre}</p>
                    )}
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p
                    className={`text-2xl font-bold ${
                      index === 0 ? 'text-emerald-400' : 'text-zinc-300'
                    }`}
                  >
                    {Math.round(result.score * 100)}%
                  </p>
                  <ConfidenceBadge score={result.confidence_score} />
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-900">
                <div
                  className={`h-full rounded-full ${
                    index === 0 ? 'bg-emerald-500' : 'bg-zinc-600'
                  }`}
                  style={{ width: `${Math.round(result.score * 100)}%` }}
                />
              </div>

              {/* Feedback */}
              <ul className="space-y-1.5">
                {result.feedback.map((line, i) => (
                  <li key={i} className="flex gap-2 text-sm text-zinc-400">
                    <span className="shrink-0 text-zinc-600">—</span>
                    {line}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {submissionId && (
          <p className="mt-6 text-center text-xs text-zinc-700">ID analisi: {submissionId}</p>
        )}
      </div>
    </div>
  )
}


function ConfidenceBadge({ score }: { score: number }) {
  if (score >= 0.6) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
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
