'use client'

import { useState, useEffect, useRef } from 'react'
import { AudioUpload } from '@/components/upload/audio-upload'
import { ReportPro } from '@/components/report/report-pro'
import { DemoScore } from '@/components/report/demo-score'
import { ReferenceComparison } from '@/components/reference/reference-comparison'
import { PublishToCatalog } from '@/components/catalog/publish-to-catalog'
import { createClient } from '@/lib/supabase/client'
import { difficultyMeta, toneClass } from '@/lib/label-display'
import Link from 'next/link'
import {
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
  sound_family?: string | null
  reliable?: boolean | null
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

  // Regola di prodotto: l'audio NON si conserva. Se l'utente riparte o lascia
  // la pagina senza pubblicare, il file viene scartato (fire-and-forget; il
  // server rifiuta da solo se nel frattempo la traccia è stata pubblicata o
  // se l'analisi è ancora in corso).
  const discardAudio = (id: string | null) => {
    if (!id || typeof navigator === 'undefined') return
    try {
      if (!navigator.sendBeacon(`/api/match/${id}/discard`)) throw new Error('beacon rifiutato')
    } catch {
      fetch(`/api/match/${id}/discard`, { method: 'POST', keepalive: true }).catch(() => {})
    }
  }

  useEffect(() => {
    if (pageStatus !== 'done' && pageStatus !== 'failed') return
    const id = submissionId
    const onHide = () => discardAudio(id)
    window.addEventListener('pagehide', onHide)
    // il cleanup copre anche la navigazione interna (unmount del componente)
    return () => { window.removeEventListener('pagehide', onHide); discardAudio(id) }
  }, [pageStatus, submissionId])

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (pageStatus === 'done' || pageStatus === 'failed') discardAudio(submissionId)
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
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
        <div className="a-in mb-10 text-center">
          <span className="mb-4 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted">
            <Sparkles className="h-3.5 w-3.5" /> A&R AI · dal suono alle label giuste
          </span>
          <h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text sm:text-5xl">Trova la tua label</h1>
          <p className="mt-3 text-muted">
            Carica la tua demo e scopri le etichette più compatibili col tuo suono
          </p>
        </div>

        {pageStatus === 'idle' && (
          <div className="space-y-6">
            <AudioUpload
              onUploadComplete={handleUploadComplete}
              onError={(err) => setError(err)}
            />

            {uploadedFile && (
              <div className="glass space-y-4 rounded-2xl p-6">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Titolo <span className="text-faint">(opzionale)</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Es. Deep Dive"
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-text placeholder-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
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
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-text placeholder-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text">
                    Stato della traccia
                  </label>
                  <select
                    value={trackStatus}
                    onChange={(e) => setTrackStatus(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                  >
                    <option value="unknown">Non specificato</option>
                    <option value="demo">Demo</option>
                    <option value="mixed">Mixed</option>
                    <option value="mastered">Mastered</option>
                  </select>
                </div>

                <button
                  onClick={handleAnalyze}
                  className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink shadow-lg transition-transform hover:scale-[1.01]"
                >
                  <Sparkles className="h-5 w-5" />
                  Analizza con AI
                </button>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
          </div>
        )}

        {pageStatus === 'analyzing' && (
          <div className="glass rounded-2xl p-8 text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 items-end justify-center gap-[3px] rounded-full bg-accent/10 p-4">
              {[10, 18, 26, 14, 22].map((h, i) => (
                <span key={i} className="eq-bar w-[3px] rounded-full bg-accent" style={{ height: h, animationDelay: `${i * 0.12}s` }} />
              ))}
            </div>
            <p className="mb-1 font-display text-lg font-semibold text-text">Sto ascoltando la tua traccia…</p>
            <p className="mb-6 text-sm text-muted">
              Leggo la firma timbrica e la confronto con i cataloghi. Fino a 90 secondi.
            </p>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-text/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 font-mono text-xs text-faint">{Math.round(progress)}%</p>
          </div>
        )}

        {pageStatus === 'failed' && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-danger/30 bg-danger/10 p-4 text-danger">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
            <button
              onClick={handleReset}
              className="glass glass-hover flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 font-medium text-text"
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

  // Arricchimento A&R: difficoltà + "accetta demo" + link label (Tier 2).
  // Best-effort: se l'endpoint o la migrazione non ci sono, semplicemente non mostra i badge.
  const [labelMeta, setLabelMeta] = useState<Map<string, any>>(new Map())
  useEffect(() => {
    fetch('/api/labels').then((r) => r.json()).then((d) => {
      const m = new Map<string, any>()
      for (const l of (d.labels ?? [])) m.set(l.id, l)
      setLabelMeta(m)
    }).catch(() => {})
  }, [])
  const hrefOut = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `https://${u}`)

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6">
        <div className="a-in mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.22em] text-muted">La tua traccia suona come</p>
            <h1 className="font-display display-tight text-3xl font-semibold tracking-tight text-text sm:text-4xl">Le tue label</h1>
            <p className="mt-1 text-sm text-muted">Top {results.length} match per il tuo suono</p>
          </div>
          <button
            onClick={onReset}
            className="glass glass-hover flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-text"
          >
            <RotateCcw className="h-4 w-4" />
            Nuova analisi
          </button>
        </div>

        {/* Dati audio rilevati dalla traccia */}
        {features && (
          <div className="glass mb-6 rounded-2xl p-4">
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
              matchPct={Math.min(100, Math.round(results[0].score * 100))}
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
                className={`rounded-2xl p-6 ${
                  isTop
                    ? 'glass-liquid ring-1 ring-text/15'
                    : 'glass'
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
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                        {result.sound_family && result.sound_family !== result.label_name && (
                          <span className="text-faint">famiglia {result.sound_family}</span>
                        )}
                        {result.reliable === false && (
                          <span className="text-warn">match meno affidabile (suono eclettico)</span>
                        )}
                      </div>
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
                <div className="mb-4 h-1.5 w-full overflow-hidden rounded-full bg-text/10">
                  <div
                    className={`h-full rounded-full ${isTop ? 'bg-accent' : 'bg-faint'}`}
                    style={{ width: `${displayScore}%` }}
                  />
                </div>

                {/* A&R: difficoltà + invio demo + link label (Tier 2) */}
                {(() => {
                  const lm = labelMeta.get(result.label_id)
                  if (!lm) return null
                  const dm = difficultyMeta(lm.reachability_score)
                  const url = hrefOut(lm.demo_submission_url)
                  return (
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                      {lm.reachability_score != null && <span className={`rounded-full px-2 py-0.5 font-medium ${toneClass[dm.tone]}`}>{dm.label}</span>}
                      {lm.accepts_unsolicited_demos
                        ? (url
                          ? <a href={url} target="_blank" rel="noreferrer" className="font-medium text-accent hover:underline">Manda la demo ↗</a>
                          : <span className="text-accent">accetta demo</span>)
                        : <span className="text-muted">su invito</span>}
                      <Link href={`/labels/${lm.slug || lm.id}`} className="ml-auto text-muted hover:text-text">Vedi label →</Link>
                    </div>
                  )
                })()}

                {/* Traccia più simile trovata */}
                {result.best_track_title && (
                  <div className={`mb-3 rounded-xl px-3 py-2 text-sm ${
                    isTop ? 'bg-text/[0.06] ring-1 ring-text/10' : 'bg-text/[0.04]'
                  }`}>
                    <span className="text-muted">Il tuo suono è vicino a: </span>
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
                    <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">
                      ⚠ Match forte su traccia singola — verifica il catalogo
                    </span>
                  )}
                  {result.match_context.includes('current_sound') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-xs font-medium text-accent">
                      ↗ In linea con il loro suono attuale
                    </span>
                  )}
                  {result.match_context.includes('legacy_match') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-text/[0.06] px-2 py-0.5 text-xs text-muted">
                      ↺ Ricorda una loro fase più vecchia
                    </span>
                  )}
                  {result.match_context.includes('consistent') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#0a84ff]/10 px-2 py-0.5 text-xs font-medium text-[#0a84ff]">
                      ◆ Stile coerente con {result.good_matches} tracce del catalogo
                    </span>
                  )}
                  {result.match_context.includes('sparse') && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-text/[0.06] px-2 py-0.5 text-xs text-muted">
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
        <div className="glass-liquid mt-8 rounded-2xl p-6 text-center">
          <h3 className="font-display text-lg font-semibold text-text">Trasforma il tuo suono in una Press Kit</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-muted">
            Una pagina condivisibile, auto-popolata dalle tue analisi, da mandare a label, PR e locali.
          </p>
          <Link href="/profile" className="mt-4 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink shadow-lg transition-transform hover:scale-[1.02]">
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
      <span className="inline-flex items-center gap-1 rounded-full bg-warn/10 px-2 py-0.5 text-xs text-warn">
        <Music className="h-3 w-3" />
        Profilo in costruzione
      </span>
    )
  }
  return null
}
