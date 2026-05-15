'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { 
  Loader2, 
  Music, 
  Clock, 
  Activity, 
  Volume2, 
  Target,
  TrendingUp,
  ArrowLeft,
  ExternalLink,
  CheckCircle,
  AlertTriangle,
  Lightbulb
} from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts'

interface TrackAnalysis {
  id: string
  title: string
  bpm: number | null
  key: string | null
  scale: string | null
  lufs: number | null
  duration_seconds: number | null
  energy_curve: number[] | null
  analysis_status: string
  created_at: string
  analysis_results: {
    ar_feedback: string
    strengths: string[]
    weaknesses: string[]
    overall_quality_score: number
    production_readiness: number
  }[]
  label_matches: {
    sound_match_score: number
    accessibility_score: number
    trend_alignment_score: number
    final_probability: number
    match_reasoning: string
    rank: number
    labels: {
      name: string
      slug: string
      demo_submission_url: string
      target_artist_level: string
    }
  }[]
}

export default function TrackAnalysisPage() {
  const params = useParams()
  const router = useRouter()
  const trackId = params.id as string
  
  const [track, setTrack] = useState<TrackAnalysis | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  useEffect(() => {
    loadTrackData()
  }, [trackId])

  const loadTrackData = async () => {
    try {
      // TEMP: Bypass authentication for testing
      const userId = '00000000-0000-0000-0000-000000000001'

      const { data, error } = await supabase
        .from('user_tracks')
        .select(`
          *,
          analysis_results (*),
          label_matches (*, labels (*))
        `)
        .eq('id', trackId)
        .eq('user_id', userId)
        .single()

      if (error) throw error
      if (!data) throw new Error('Track not found')

      setTrack(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '--:--'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500'
    if (score >= 50) return 'text-yellow-500'
    return 'text-red-500'
  }

  const getScoreBg = (score: number) => {
    if (score >= 70) return 'bg-emerald-500'
    if (score >= 50) return 'bg-yellow-500'
    return 'bg-red-500'
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-500" />
      </div>
    )
  }

  if (error || !track) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black px-4">
        <AlertTriangle className="mb-4 h-12 w-12 text-red-500" />
        <p className="text-zinc-400">{error || 'Track not found'}</p>
        <button
          onClick={() => router.push('/dashboard')}
          className="mt-4 flex items-center gap-2 text-emerald-500 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Torna alla Dashboard
        </button>
      </div>
    )
  }

  const analysisResult = track.analysis_results?.[0]
  const matches = track.label_matches || []
  
  // Fix: ensure energy_curve is always an array
  const energyCurve = Array.isArray(track.energy_curve) ? track.energy_curve : []
  const energyData = energyCurve.map((value, index) => ({
    time: `${(index * (track.duration_seconds || 0) / (energyCurve.length || 1) / 60).toFixed(1)}m`,
    energy: Math.round((value || 0) * 100),
  }))

  return (
    <div className="min-h-screen bg-black pb-12">
      <div className="border-b border-zinc-800 bg-zinc-950/50">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 rounded-lg p-2 text-zinc-400 hover:bg-zinc-900 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{track.title}</h1>
            <p className="text-sm text-zinc-500">
              Analisi completata il {new Date(track.created_at).toLocaleDateString('it-IT')}
            </p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left Column - Stats */}
          <div className="space-y-6">
            {/* Audio Features */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">Caratteristiche Audio</h2>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-zinc-500">
                    <Music className="h-4 w-4" />
                    <span className="text-xs uppercase">BPM</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{track.bpm?.toFixed(1) || '--'}</p>
                </div>

                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-zinc-500">
                    <Target className="h-4 w-4" />
                    <span className="text-xs uppercase">Key</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{track.key || '--'} {track.scale || ''}</p>
                </div>

                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-zinc-500">
                    <Clock className="h-4 w-4" />
                    <span className="text-xs uppercase">Durata</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{formatDuration(track.duration_seconds)}</p>
                </div>

                <div className="rounded-lg bg-zinc-900/50 p-4">
                  <div className="mb-1 flex items-center gap-2 text-zinc-500">
                    <Volume2 className="h-4 w-4" />
                    <span className="text-xs uppercase">LUFS</span>
                  </div>
                  <p className="text-2xl font-bold text-white">{track.lufs?.toFixed(1) || '--'}</p>
                </div>
              </div>
            </div>

            {/* Overall Score */}
            {analysisResult && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">Valutazione Complessiva</h2>
                
                <div className="space-y-4">
                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-zinc-400">Qualità Produzione</span>
                      <span className={`font-bold ${getScoreColor(analysisResult.overall_quality_score || 0)}`}>
                        {Math.round(analysisResult.overall_quality_score || 0)}/100
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className={`h-full ${getScoreBg(analysisResult.overall_quality_score || 0)}`}
                        style={{ width: `${analysisResult.overall_quality_score || 0}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-zinc-400">Prontezza Release</span>
                      <span className={`font-bold ${getScoreColor(analysisResult.production_readiness || 0)}`}>
                        {Math.round(analysisResult.production_readiness || 0)}/100
                      </span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-900">
                      <div
                        className={`h-full ${getScoreBg(analysisResult.production_readiness || 0)}`}
                        style={{ width: `${analysisResult.production_readiness || 0}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Energy Curve */}
            {energyData.length > 0 && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
                <h2 className="mb-4 text-lg font-semibold text-white">Curva Energia</h2>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={energyData}>
                      <XAxis 
                        dataKey="time" 
                        stroke="#52525b" 
                        fontSize={10}
                        tickLine={false}
                      />
                      <YAxis 
                        stroke="#52525b" 
                        fontSize={10}
                        tickLine={false}
                        domain={[0, 100]}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: '#18181b', 
                          border: '1px solid #27272a',
                          borderRadius: '8px'
                        }}
                        labelStyle={{ color: '#a1a1aa' }}
                      />
                      
                      <Line
                        type="monotone"
                        dataKey="energy"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Middle + Right Column - A&R Feedback and Matches */}
          <div className="space-y-6 lg:col-span-2">
            {/* A&R Feedback */}
            {analysisResult?.ar_feedback && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                    <Activity className="h-5 w-5 text-emerald-500" />
                  </div>
                  <h2 className="text-lg font-semibold text-white">Feedback A&R</h2>
                </div>
                
                <div className="prose prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-zinc-300 leading-relaxed">
                    {analysisResult.ar_feedback}
                  </div>
                </div>
              </div>
            )}

            {/* Label Matches */}
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white">Label Matching</h2>
                  <p className="text-sm text-zinc-500">Top label compatibili con il tuo sound</p>
                </div>
              </div>

                {matches.length === 0 ? (
                  <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-8 text-center">
                    <p className="text-zinc-400">Nessun label match trovato. L&apos;analisi è in corso o non ci sono abbastanza dati.</p>
                  </div>
                ) : (
                  matches
                    .sort((a, b) => a.rank - b.rank)
                    .map((match) => (
                      <div
                        key={match.labels?.slug || match.label_id}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-5 transition-colors hover:border-zinc-700"
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <div>
                            <div className="flex items-center gap-3">
                              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-800 text-sm font-bold text-white">
                                #{match.rank}
                              </span>
                              <h3 className="text-lg font-semibold text-white">{match.labels?.name || 'Unknown Label'}</h3>
                            </div>
                            <p className="mt-2 text-sm text-zinc-400">{match.match_reasoning || 'No reasoning available'}</p>
                          </div>
                          
                          <div className="text-right">
                            <p className={`text-3xl font-bold ${getScoreColor(match.final_probability || 0)}`}>
                              {Math.round(match.final_probability || 0)}%
                            </p>
                            <p className="text-xs text-zinc-500">Probabilità</p>
                          </div>
                        </div>

                        <div className="mb-4 grid grid-cols-3 gap-4">
                          <div className="rounded-lg bg-zinc-950 p-3">
                            <p className="text-xs text-zinc-500">Sound Match</p>
                            <p className={`text-lg font-bold ${getScoreColor(match.sound_match_score || 0)}`}>
                              {Math.round(match.sound_match_score || 0)}
                            </p>
                          </div>
                          
                          <div className="rounded-lg bg-zinc-950 p-3">
                            <p className="text-xs text-zinc-500">Accessibilità</p>
                            <p className={`text-lg font-bold ${getScoreColor(match.accessibility_score || 0)}`}>
                              {Math.round(match.accessibility_score || 0)}
                            </p>
                          </div>
                          
                          <div className="rounded-lg bg-zinc-950 p-3">
                            <p className="text-xs text-zinc-500">Trend</p>
                            <p className={`text-lg font-bold ${getScoreColor(match.trend_alignment_score || 0)}`}>
                              {Math.round(match.trend_alignment_score || 0)}
                            </p>
                          </div>
                        </div>

                        {match.labels?.demo_submission_url && (
                          <a
                            href={match.labels.demo_submission_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-sm text-emerald-500 hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Sito demo submission
                          </a>
                        )}
                      </div>
                    ))
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
