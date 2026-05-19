'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Track {
  id: string
  track_title: string
  artist_name: string
  status: string
  spotify_match_confidence: number
  spotify_preview_url: string | null
  created_at: string
}

interface Label {
  id: string
  name: string
  slug: string
  primary_genre: string
  cataloged_tracks: number
}

export default function LabelDetailPage() {
  const params = useParams()
  const labelId = params.id as string
  
  const [label, setLabel] = useState<Label | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [rawText, setRawText] = useState('')
  const [parsedCount, setParsedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'report' | 'add'>('report')
  const [processing, setProcessing] = useState(false)
  const [stats, setStats] = useState({
    pending: 0,
    matched: 0,
    needs_review: 0,
    failed: 0
  })

  useEffect(() => {
    if (labelId) {
      fetchLabelData()
    }
  }, [labelId])

  const fetchLabelData = async () => {
    try {
      // Fetch label info
      const labelRes = await fetch(`/api/admin/labels?id=${labelId}`)
      const labelData = await labelRes.json()
      if (labelRes.ok) {
        setLabel(labelData.label)
      }

      // Fetch tracks
      const tracksRes = await fetch(`/api/admin/label-tracks?label_id=${labelId}`)
      const tracksData = await tracksRes.json()
      if (tracksRes.ok) {
        setTracks(tracksData.tracks || [])
        // Calculate stats
        const counts = { pending: 0, matched: 0, needs_review: 0, failed: 0 }
        tracksData.tracks?.forEach((t: Track) => {
          counts[t.status as keyof typeof counts]++
        })
        setStats(counts)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const parseText = () => {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0)
    let count = 0
    
    for (const line of lines) {
      const trimmed = line.trim()
      // Pattern: "Artista - Titolo"
      if (trimmed.match(/^(.+?)\s*[-–—]\s*(.+)/)) {
        count++
      } else if (trimmed.includes(' - ')) {
        count++
      }
    }
    
    setParsedCount(count)
  }

  const addTracks = async () => {
    if (!rawText.trim() || parsedCount === 0) return
    
    setProcessing(true)
    
    const lines = rawText.split('\n')
    const tracksToAdd = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue
      
      const match = trimmed.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/)
      if (match) {
        tracksToAdd.push({
          artist: match[1].trim(),
          title: match[2].trim()
        })
      } else if (trimmed.includes(' - ')) {
        const parts = trimmed.split(' - ')
        tracksToAdd.push({
          artist: parts[0].trim(),
          title: parts.slice(1).join(' - ').trim()
        })
      }
    }
    
    try {
      const response = await fetch('/api/admin/add-tracks-to-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label_id: labelId,
          tracks: tracksToAdd
        })
      })
      
      if (response.ok) {
        setRawText('')
        setParsedCount(0)
        setActiveTab('report')
        fetchLabelData() // Refresh
      }
    } catch (error) {
      console.error('Error adding tracks:', error)
    } finally {
      setProcessing(false)
    }
  }

  const startMatching = async () => {
    if (stats.pending === 0) return
    
    setProcessing(true)
    
    try {
      await fetch('/api/admin/process-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: labelId, batch_size: 5 })
      })
      
      // Poll per aggiornamenti
      const interval = setInterval(async () => {
        await fetchLabelData()
      }, 5000)
      
      // Ferma dopo 2 minuti
      setTimeout(() => {
        clearInterval(interval)
        setProcessing(false)
      }, 120000)
      
    } catch (error) {
      console.error('Error starting matching:', error)
      setProcessing(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-white">Caricamento...</div>
  }

  if (!label) {
    return <div className="min-h-screen bg-black p-8 text-white">Label non trovata</div>
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <a href="/admin/labels" className="text-sm text-zinc-500 hover:text-white">← Torna alle label</a>
          <h1 className="mt-2 text-2xl font-bold text-white">{label.name}</h1>
          <p className="text-zinc-500">{label.primary_genre} • {tracks.length} tracce</p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-4 gap-4">
          <div className="rounded-lg bg-zinc-900/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{stats.pending}</p>
            <p className="text-xs text-zinc-500">In attesa</p>
          </div>
          <div className="rounded-lg bg-emerald-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{stats.matched}</p>
            <p className="text-xs text-zinc-500">Match trovati</p>
          </div>
          <div className="rounded-lg bg-yellow-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{stats.needs_review}</p>
            <p className="text-xs text-zinc-500">Da verificare</p>
          </div>
          <div className="rounded-lg bg-red-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{stats.failed}</p>
            <p className="text-xs text-zinc-500">Non trovati</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('report')}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'report' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            📊 Report Tracce
          </button>
          <button
            onClick={() => setActiveTab('add')}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'add' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            ➕ Aggiungi Tracce
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'report' ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Lista Tracce</h2>
              {stats.pending > 0 && (
                <button
                  onClick={startMatching}
                  disabled={processing}
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
                >
                  {processing ? 'Analisi in corso...' : '🔍 Avvia Matching Spotify'}
                </button>
              )}
            </div>
            
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="border-b border-zinc-800">
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Artista</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Titolo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Stato</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Confidence</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {tracks.map((track) => (
                      <tr key={track.id} className="hover:bg-zinc-800/50">
                        <td className="px-4 py-3 text-sm text-white">{track.artist_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-white">{track.track_title}</td>
                        <td className="px-4 py-3">
                          {track.status === 'matched' && <span className="rounded bg-emerald-900/50 px-2 py-1 text-xs text-emerald-400">✓ Match</span>}
                          {track.status === 'needs_review' && <span className="rounded bg-yellow-900/50 px-2 py-1 text-xs text-yellow-400">⚠ Verifica</span>}
                          {track.status === 'failed' && <span className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400">✗ Non trovato</span>}
                          {track.status === 'pending' && <span className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-400">⏳ In attesa</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-zinc-400">
                          {track.spotify_match_confidence 
                            ? `${(track.spotify_match_confidence * 100).toFixed(0)}%` 
                            : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 font-semibold text-white">Aggiungi Tracce</h2>
            
            <p className="mb-4 text-sm text-zinc-400">
              Incolla la lista tracce da Beatport/Traxsource (formato: Artista - Titolo)
            </p>
            
            <textarea
              value={rawText}
              onChange={(e) => {
                setRawText(e.target.value)
                parseText()
              }}
              className="mb-4 h-48 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white font-mono text-sm"
              placeholder="Adam Beyer - Your Mind&#10;Charlotte de Witte - Selected&#10;..."
            />
            
            {parsedCount > 0 && (
              <p className="mb-4 text-sm text-emerald-400">{parsedCount} tracce riconosciute</p>
            )}
            
            <button
              onClick={addTracks}
              disabled={!rawText.trim() || parsedCount === 0 || processing}
              className="rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
            >
              {processing ? 'Aggiungendo...' : `Aggiungi ${parsedCount} Tracce`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
