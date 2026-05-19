'use client'

import { useState, useEffect, useCallback } from 'react'

interface ParsedTrack {
  artist: string
  title: string
  selected: boolean
}

interface ProcessingStatus {
  isProcessing: boolean
  isPaused: boolean
  processed: number
  total: number
  matched: number
  needs_review: number
  failed: number
  currentTrack: string
  quotaRemaining: number
}

export default function BulkAddPage() {
  const [labelName, setLabelName] = useState('')
  const [slug, setSlug] = useState('')
  const [genre, setGenre] = useState('tech house')
  const [rawText, setRawText] = useState('')
  const [parsedTracks, setParsedTracks] = useState<ParsedTrack[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [labelId, setLabelId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<ProcessingStatus | null>(null)
  const [message, setMessage] = useState('')
  const [showQuotaWarning, setShowQuotaWarning] = useState(false)

  // Auto-genera slug
  useEffect(() => {
    setSlug(labelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }, [labelName])

  // Parsing testo
  const parseText = useCallback(() => {
    if (!rawText.trim()) return
    
    setIsParsing(true)
    
    const lines = rawText.split('\n')
    const tracks: ParsedTrack[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length < 3) continue
      
      // Pattern: "Artista - Titolo" o "Artista – Titolo" o "Artista — Titolo"
      const match = trimmed.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/)
      
      if (match) {
        tracks.push({
          artist: match[1].trim(),
          title: match[2].trim(),
          selected: true
        })
      } else if (trimmed.includes(' - ')) {
        // Fallback semplice
        const parts = trimmed.split(' - ')
        if (parts.length >= 2) {
          tracks.push({
            artist: parts[0].trim(),
            title: parts.slice(1).join(' - ').trim(),
            selected: true
          })
        }
      }
    }
    
    setParsedTracks(tracks)
    setIsParsing(false)
  }, [rawText])

  const toggleTrack = (index: number) => {
    setParsedTracks(prev => prev.map((t, i) => 
      i === index ? { ...t, selected: !t.selected } : t
    ))
  }

  const selectAll = () => {
    setParsedTracks(prev => prev.map(t => ({ ...t, selected: true })))
  }

  const deselectAll = () => {
    setParsedTracks(prev => prev.map(t => ({ ...t, selected: false })))
  }

  const createLabelAndStart = async () => {
    const selectedTracks = parsedTracks.filter(t => t.selected)
    
    if (selectedTracks.length === 0) {
      setMessage('✗ Seleziona almeno una traccia')
      return
    }

    try {
      // 1. Crea label
      const labelResponse = await fetch('/api/admin/add-label-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: labelName,
          slug,
          genre,
          tracks: selectedTracks
        })
      })

      const labelData = await labelResponse.json()
      
      if (!labelResponse.ok) {
        setMessage(`✗ Errore: ${labelData.error}`)
        return
      }

      setLabelId(labelData.label.id)
      setMessage(`✓ Label creata con ${selectedTracks.length} tracce`)
      
      // 2. Avvia processing
      startProcessing(labelData.label.id, labelName, selectedTracks.length)
      
    } catch (error) {
      setMessage('✗ Errore di connessione')
    }
  }

  const startProcessing = async (id: string, name: string, total: number) => {
    setProcessing({
      isProcessing: true,
      isPaused: false,
      processed: 0,
      total,
      matched: 0,
      needs_review: 0,
      failed: 0,
      currentTrack: '',
      quotaRemaining: 10000
    })

    // Inizia il loop di processing
    processNextBatch(id)
  }

  const processNextBatch = async (id: string) => {
    if (!processing || processing.isPaused) return

    try {
      const response = await fetch('/api/admin/process-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          label_id: id, 
          batch_size: 3, // Piccolo per rispettare rate limit
          throttle: true 
        })
      })

      const data = await response.json()

      if (response.ok) {
        // Aggiorna stato
        setProcessing(prev => {
          if (!prev) return null
          
          const newProcessed = prev.processed + data.processed
          const quotaUsed = newProcessed * 2 // ricerca + analisi
          const quotaRemaining = 10000 - quotaUsed
          
          // Avviso quota
          if (quotaRemaining < 1000 && !showQuotaWarning) {
            setShowQuotaWarning(true)
          }
          
          return {
            ...prev,
            processed: newProcessed,
            matched: prev.matched + (data.stats?.matched || 0),
            needs_review: prev.needs_review + (data.stats?.needs_review || 0),
            failed: prev.failed + (data.stats?.failed || 0),
            currentTrack: data.currentTrack || '',
            quotaRemaining,
            isProcessing: data.remaining > 0 && !prev.isPaused
          }
        })

        // Continua se non finito e non in pausa
        if (data.remaining > 0 && processing?.isProcessing && !processing?.isPaused) {
          // Delay per rispettare rate limit (12 secondi = 5 req/min)
          setTimeout(() => processNextBatch(id), 12000)
        }
      }
    } catch (error) {
      console.error('Processing error:', error)
      // Riprova dopo 30 secondi in caso di errore
      setTimeout(() => processNextBatch(id), 30000)
    }
  }

  const togglePause = () => {
    setProcessing(prev => {
      if (!prev) return null
      const newPaused = !prev.isPaused
      
      if (!newPaused && labelId) {
        // Riprendi
        setTimeout(() => processNextBatch(labelId), 1000)
      }
      
      return { ...prev, isPaused: newPaused }
    })
  }

  const stopProcessing = () => {
    setProcessing(prev => prev ? { ...prev, isProcessing: false, isPaused: true } : null)
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-4xl">
        <h1 className="mb-8 text-2xl font-bold text-white">Aggiungi Label (Bulk)</h1>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
          </div>
        )}

        {showQuotaWarning && (
          <div className="mb-6 rounded-lg border border-yellow-500/30 bg-yellow-900/20 p-4">
            <p className="text-yellow-400">⚠️ Attenzione: Quota Spotify in esaurimento ({processing?.quotaRemaining} rimanenti)</p>
          </div>
        )}

        {/* Processing Status */}
        {processing && (
          <div className={`mb-6 rounded-lg border p-4 ${processing.isPaused ? 'border-yellow-500/30 bg-yellow-900/20' : 'border-emerald-500/30 bg-emerald-900/20'}`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white">
                {processing.isPaused ? '⏸️ In pausa' : processing.isProcessing ? '🔍 Analisi in corso...' : '✓ Completato'}
              </h3>
              <div className="flex gap-2">
                {processing.isProcessing && (
                  <>
                    <button
                      onClick={togglePause}
                      className="rounded bg-zinc-700 px-3 py-1 text-sm text-white hover:bg-zinc-600"
                    >
                      {processing.isPaused ? '▶️ Riprendi' : '⏸️ Pausa'}
                    </button>
                    <button
                      onClick={stopProcessing}
                      className="rounded bg-red-900/50 px-3 py-1 text-sm text-red-400 hover:bg-red-900"
                    >
                      ⏹️ Ferma
                    </button>
                  </>
                )}
              </div>
            </div>
            
            <p className="text-sm text-zinc-400 mb-2">{processing.currentTrack}</p>
            
            <div className="w-full bg-zinc-800 rounded-full h-2 mb-3">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((processing.processed / processing.total) * 100, 100)}%` }}
              />
            </div>
            
            <p className="text-sm text-zinc-400 mb-3">
              {processing.processed} / {processing.total} tracce • Quota: {processing.quotaRemaining}
            </p>
            
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-emerald-400">{processing.matched}</p>
                <p className="text-xs text-zinc-500">Match</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-yellow-400">{processing.needs_review}</p>
                <p className="text-xs text-zinc-500">Verifica</p>
              </div>
              <div className="bg-zinc-900/50 rounded-lg p-2">
                <p className="text-lg font-bold text-red-400">{processing.failed}</p>
                <p className="text-xs text-zinc-500">Non trovati</p>
              </div>
            </div>
          </div>
        )}

        {!processing?.isProcessing && (
          <>
            {/* Form Label */}
            <div className="mb-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Nome Label</label>
                <input
                  type="text"
                  value={labelName}
                  onChange={(e) => setLabelName(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
                  placeholder="es. Drumcode"
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Slug</label>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
                />
              </div>
              
              <div>
                <label className="mb-2 block text-sm text-zinc-400">Genere</label>
                <select
                  value={genre}
                  onChange={(e) => setGenre(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white"
                >
                  <option value="tech house">Tech House</option>
                  <option value="techno">Techno</option>
                  <option value="house">House</option>
                  <option value="deep house">Deep House</option>
                  <option value="minimal">Minimal</option>
                </select>
              </div>
            </div>

            {/* Input Testo */}
            <div className="mb-6">
              <label className="mb-2 block text-sm text-zinc-400">
                Incolla tracce da Beatport/Traxsource
              </label>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                className="h-40 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white font-mono text-sm"
                placeholder="Adam Beyer - Your Mind&#10;Charlotte de Witte - Selected&#10;Enrico Sangiuliano - Astral Projection"
              />
              <button
                onClick={parseText}
                disabled={!rawText || isParsing}
                className="mt-2 rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600 disabled:opacity-50"
              >
                {isParsing ? 'Parsing...' : 'Analizza testo'}
              </button>
            </div>

            {/* Lista Tracce Parsate */}
            {parsedTracks.length > 0 && (
              <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-semibold text-white">
                    {parsedTracks.filter(t => t.selected).length} / {parsedTracks.length} tracce selezionate
                  </h3>
                  <div className="flex gap-2">
                    <button
                      onClick={selectAll}
                      className="text-sm text-emerald-400 hover:text-emerald-300"
                    >
                      Seleziona tutte
                    </button>
                    <span className="text-zinc-600">|</span>
                    <button
                      onClick={deselectAll}
                      className="text-sm text-zinc-400 hover:text-white"
                    >
                      Deseleziona tutte
                    </button>
                  </div>
                </div>
                
                <div className="max-h-60 overflow-auto space-y-2">
                  {parsedTracks.map((track, index) => (
                    <div
                      key={index}
                      onClick={() => toggleTrack(index)}
                      className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${
                        track.selected 
                          ? 'border-emerald-500/30 bg-emerald-900/20' 
                          : 'border-zinc-800 bg-zinc-950'
                      }`}
                    >
                      <span className={track.selected ? 'text-emerald-400' : 'text-zinc-600'}>
                        {track.selected ? '☑' : '☐'}
                      </span>
                      <div className="flex-1">
                        <p className="text-white">{track.artist}</p>
                        <p className="text-sm text-zinc-500">{track.title}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={createLabelAndStart}
                  disabled={!labelName || parsedTracks.filter(t => t.selected).length === 0}
                  className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  🚀 Crea Label e Avvia Analisi
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Istruzioni:</h2>
          <ol className="space-y-1 text-sm text-zinc-400 list-decimal list-inside">
            <li>Vai su Beatport/Traxsource e trova la pagina label</li>
            <li>Seleziona e copia la lista tracce (Ctrl+A, Ctrl+C)</li>
            <li>Incolla nel campo sopra e clicca "Analizza testo"</li>
            <li>Seleziona le tracce corrette dalla lista</li>
            <li>Clicca "Crea Label e Avvia Analisi"</li>
            <li>Il sistema cercherà automaticamente su Spotify (max 5 tracce/min)</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
