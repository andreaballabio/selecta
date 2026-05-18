'use client'

import { useState, useEffect, useCallback } from 'react'

interface DiscogsResult {
  id: number
  name: string
  url: string
  thumbnail: string
  releases: number
  profile: string
  sampleReleases: Array<{
    artist: string
    title: string
  }>
}

interface ProcessingStatus {
  isProcessing: boolean
  processed: number
  total: number
  matched: number
  needs_review: number
  failed: number
  labelName: string
}

export default function AddLabelPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    genre: 'tech house',
    discogsUrl: ''
  })
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')
  const [discogsResults, setDiscogsResults] = useState<DiscogsResult[]>([])
  const [selectedDiscogs, setSelectedDiscogs] = useState<DiscogsResult | null>(null)
  
  // Stato per il processing
  const [lastAddedLabel, setLastAddedLabel] = useState<{id: string, name: string, tracks: number} | null>(null)
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null)
  const [processingInterval, setProcessingInterval] = useState<NodeJS.Timeout | null>(null)

  // Debounce search su Discogs
  useEffect(() => {
    if (!formData.name || formData.name.length < 3) {
      setDiscogsResults([])
      return
    }

    const timer = setTimeout(() => {
      searchDiscogs(formData.name)
    }, 600)

    return () => clearTimeout(timer)
  }, [formData.name])

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (processingInterval) {
        clearInterval(processingInterval)
      }
    }
  }, [processingInterval])

  const searchDiscogs = async (query: string) => {
    if (query.length < 3) return
    
    setSearching(true)
    
    try {
      const response = await fetch(`/api/admin/add-label?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (response.ok) {
        setDiscogsResults(data.results || [])
      }
    } catch (error) {
      console.error('Error searching Discogs:', error)
    } finally {
      setSearching(false)
    }
  }

  const selectDiscogsLabel = (result: DiscogsResult) => {
    setSelectedDiscogs(result)
    setFormData(prev => ({
      ...prev,
      name: result.name,
      slug: result.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''),
      discogsUrl: result.url
    }))
    setDiscogsResults([])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/add-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await response.json()

      if (response.ok) {
        setMessage(`✓ ${data.message}`)
        // Salva info label appena aggiunta
        if (data.label) {
          setLastAddedLabel({
            id: data.label.id,
            name: data.label.name,
            tracks: data.label.tracksQueued || 0
          })
        }
        setFormData({ name: '', slug: '', genre: 'tech house', discogsUrl: '' })
        setSelectedDiscogs(null)
      } else {
        setMessage(`✗ Errore: ${data.error}`)
      }
    } catch (error) {
      setMessage('✗ Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  const startProcessing = async (labelId: string, labelName: string, totalTracks: number) => {
    setProcessing({
      isProcessing: true,
      processed: 0,
      total: totalTracks,
      matched: 0,
      needs_review: 0,
      failed: 0,
      labelName
    })

    // Avvia polling automatico
    const interval = setInterval(async () => {
      await processBatch(labelId)
    }, 3000) // Ogni 3 secondi

    setProcessingInterval(interval)
    
    // Processa subito il primo batch
    await processBatch(labelId)
  }

  const processBatch = async (labelId: string) => {
    try {
      const response = await fetch('/api/admin/process-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: labelId, batch_size: 5 })
      })

      const data = await response.json()

      if (response.ok && data.processed > 0) {
        setProcessing(prev => {
          if (!prev) return null
          const newProcessed = prev.processed + data.processed
          const isComplete = newProcessed >= prev.total || data.remaining === 0
          
          return {
            ...prev,
            processed: newProcessed,
            matched: prev.matched + (data.stats?.matched || 0),
            needs_review: prev.needs_review + (data.stats?.needs_review || 0),
            failed: prev.failed + (data.stats?.failed || 0),
            isProcessing: !isComplete
          }
        })

        // Se finito, ferma il polling
        if (data.remaining === 0 || data.processed === 0) {
          if (processingInterval) {
            clearInterval(processingInterval)
            setProcessingInterval(null)
          }
        }
      } else if (data.processed === 0) {
        // Nessuna traccia da processare
        if (processingInterval) {
          clearInterval(processingInterval)
          setProcessingInterval(null)
        }
        setProcessing(prev => prev ? { ...prev, isProcessing: false } : null)
      }
    } catch (error) {
      console.error('Processing error:', error)
    }
  }

  const stopProcessing = () => {
    if (processingInterval) {
      clearInterval(processingInterval)
      setProcessingInterval(null)
    }
    setProcessing(prev => prev ? { ...prev, isProcessing: false } : null)
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-8 text-2xl font-bold text-white">Aggiungi Label</h1>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
          </div>
        )}

        {/* Sezione Processing */}
        {processing && (
          <div className={`mb-6 rounded-lg border p-4 ${processing.isProcessing ? 'border-emerald-500/30 bg-emerald-900/20' : 'border-zinc-700 bg-zinc-900/50'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">
                {processing.isProcessing ? '🔍 Matching in corso...' : '✓ Matching completato'}
              </h3>
              {processing.isProcessing && (
                <button
                  onClick={stopProcessing}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Pausa
                </button>
              )}
            </div>
            
            <p className="text-sm text-zinc-400 mb-3">
              {processing.labelName}: {processing.processed} / {processing.total} tracce
            </p>
            
            {/* Progress bar */}
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-4">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((processing.processed / processing.total) * 100, 100)}%` }}
              />
            </div>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-400">{processing.matched}</p>
                <p className="text-xs text-zinc-500">Match trovati</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-yellow-400">{processing.needs_review}</p>
                <p className="text-xs text-zinc-500">Da verificare</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-red-400">{processing.failed}</p>
                <p className="text-xs text-zinc-500">Non trovati</p>
              </div>
            </div>
          </div>
        )}

        {/* Label appena aggiunta - pulsante matching */}
        {lastAddedLabel && !processing && (
          <div className="mb-6 rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-4">
            <h3 className="font-semibold text-white mb-2">✓ Label aggiunta!</h3>
            <p className="text-sm text-zinc-400 mb-4">
              {lastAddedLabel.name} - {lastAddedLabel.tracks} tracce in coda
            </p>
            <button
              onClick={() => startProcessing(lastAddedLabel.id, lastAddedLabel.name, lastAddedLabel.tracks)}
              className="w-full rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400 transition-colors"
            >
              🚀 Avvia Matching con Spotify
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm text-zinc-400">Nome Label</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value
                setFormData({
                  ...formData,
                  name,
                  slug: name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
                })
                if (!name) {
                  setSelectedDiscogs(null)
                }
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="es. Drumcode"
              required
            />
            
            {searching && (
              <p className="mt-2 text-sm text-zinc-500">Ricerca su Discogs...</p>
            )}
            
            {/* Risultati Discogs */}
            {discogsResults.length > 0 && (
              <div className="mt-3 space-y-2">
                <p className="text-sm text-zinc-500">Seleziona da Discogs:</p>
                {discogsResults.map((result) => (
                  <div
                    key={result.id}
                    onClick={() => selectDiscogsLabel(result)}
                    className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3 transition-colors hover:border-emerald-500/50"
                  >
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded bg-zinc-800">
                      {result.thumbnail ? (
                        <img src={result.thumbnail} alt={result.name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xl text-zinc-600">♪</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">{result.name}</h4>
                      
                      {/* Sample releases */}
                      {result.sampleReleases && result.sampleReleases.length > 0 && (
                        <div className="mt-2 space-y-0.5">
                          <p className="text-xs text-zinc-600">Uscite recenti:</p>
                          {result.sampleReleases.slice(0, 3).map((release, i) => (
                            <p key={i} className="text-xs text-zinc-500 truncate">
                              • <span className="text-zinc-400">{release.artist}</span> - {release.title}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                    <span className="text-emerald-400 text-sm">Seleziona →</span>
                  </div>
                ))}
              </div>
            )}
            
            {/* Label selezionata */}
            {selectedDiscogs && (
              <div className="mt-3 flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-900/20 p-3">
                <div className="text-emerald-400">✓</div>
                <div>
                  <p className="text-white font-medium">{selectedDiscogs.name}</p>
                  <p className="text-sm text-zinc-400">Da Discogs</p>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">Slug (auto-generato)</label>
            <input
              type="text"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="drumcode"
              required
            />
            <p className="mt-1 text-xs text-zinc-600">Usato nell&apos;URL, solo lettere minuscole e trattini</p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">Genere</label>
            <select
              value={formData.genre}
              onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white focus:border-emerald-500 focus:outline-none"
            >
              <option value="tech house">Tech House</option>
              <option value="techno">Techno</option>
              <option value="house">House</option>
              <option value="deep house">Deep House</option>
              <option value="minimal">Minimal</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-zinc-400">URL Discogs (opzionale)</label>
            <input
              type="url"
              value={formData.discogsUrl}
              onChange={(e) => setFormData({ ...formData, discogsUrl: e.target.value })}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="https://www.discogs.com/label/12345"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50"
          >
            {loading ? 'Aggiungendo...' : 'Aggiungi Label'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Come funziona:</h2>
          <ol className="space-y-1 text-sm text-zinc-400 list-decimal list-inside">
            <li>Scrivi il nome della label</li>
            <li>Seleziona da Discogs (se trovata)</li>
            <li>Aggiungi al database</li>
            <li>Clicca &quot;Avvia Matching&quot; per cercare su Spotify</li>
            <li>Il sistema analizza automaticamente le tracce trovate</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
