'use client'

import { useState, useEffect } from 'react'
import { AudioUpload } from '@/components/upload/audio-upload'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { Loader2, Sparkles, AlertCircle } from 'lucide-react'

export default function DashboardPage() {
  const [uploadedFile, setUploadedFile] = useState<{ path: string; name: string; size: number } | null>(null)
  const [trackTitle, setTrackTitle] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tracks, setTracks] = useState<any[]>([])
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadUserTracks()
  }, [])

  const loadUserTracks = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('user_tracks')
      .select(`
        *,
        analysis_results (*),
        label_matches (*, labels (*))
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (data) setTracks(data)
  }

  const handleUploadComplete = (path: string, name: string, size: number) => {
    setUploadedFile({ path, name, size })
    // Extract title from filename (remove extension)
    const title = name.replace(/\.[^/.]+$/, '')
    setTrackTitle(title)
    setError(null)
  }

  const handleAnalyze = async () => {
    if (!uploadedFile || !trackTitle.trim()) {
      setError('Inserisci un titolo per la traccia')
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Create track record
      const { data: track, error: trackError } = await (supabase as any)
        .from('user_tracks')
        .insert({
          user_id: user.id,
          title: trackTitle,
          storage_path: uploadedFile.path,
          file_name: uploadedFile.name,
          file_size_bytes: uploadedFile.size,
          file_format: uploadedFile.name.split('.').pop()?.toLowerCase() as any,
          analysis_status: 'pending',
        })
        .select()
        .single()

      if (trackError) throw trackError

      // Trigger analysis
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackId: track.id }),
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.error || 'Analysis failed')
      }

      // Navigate to results page
      router.push(`/dashboard/track/${track.id}`)

    } catch (err: any) {
      setError(err.message || 'Analysis failed')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="mt-2 text-zinc-400">
            Carica la tua traccia per ricevere un'analisi A&R completa
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Upload Section */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
              <h2 className="mb-4 text-lg font-semibold text-white">
                Carica Traccia
              </h2>
              
              <AudioUpload
                onUploadComplete={handleUploadComplete}
                onError={(err) => setError(err)}
              />

              {uploadedFile && (
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="mb-2 block text-sm font-medium text-zinc-300">
                      Titolo Traccia
                    </label>
                    <input
                      type="text"
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                      placeholder="Inserisci il titolo..."
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>

                  <button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing || !trackTitle.trim()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-6 py-3 font-medium text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Analisi in corso...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Analizza con AI
                      </>
                    )}
                  </button>
                </div>
              )}

              {error && (
                <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/30 p-4 text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent Tracks */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              Tracce Recenti
            </h2>

            {tracks.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <p className="text-zinc-500">Nessuna traccia ancora caricata</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tracks.map((track) => (
                  <button
                    key={track.id}
                    onClick={() => router.push(`/dashboard/track/${track.id}`)}
                    className="flex w-full items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-left transition-colors hover:border-zinc-700 hover:bg-zinc-900"
                  >
                    <div>
                      <p className="font-medium text-white">{track.title}</p>
                      <p className="text-sm text-zinc-500">
                        {new Date(track.created_at).toLocaleDateString('it-IT')}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {track.analysis_status === 'completed' ? (
                        <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-500">
                          Completato
                        </span>
                      ) : track.analysis_status === 'processing' ? (
                        <span className="flex items-center gap-1 rounded-full bg-yellow-500/10 px-3 py-1 text-xs font-medium text-yellow-500">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          In corso
                        </span>
                      ) : track.analysis_status === 'failed' ? (
                        <span className="rounded-full bg-red-500/10 px-3 py-1 text-xs font-medium text-red-500">
                          Errore
                        </span>
                      ) : (
                        <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-medium text-zinc-500">
                          In attesa
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
