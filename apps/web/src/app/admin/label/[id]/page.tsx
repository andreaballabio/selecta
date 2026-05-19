'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface Track {
  id: string
  track_title: string
  artist_name: string
  status: string
  spotify_track_id: string | null
  spotify_track_name: string | null
  spotify_artist_name: string | null
  spotify_url: string | null
  spotify_album_name: string | null
  spotify_album_image: string | null
  spotify_preview_url: string | null
  spotify_duration_ms: number | null
  spotify_match_confidence: number
  suggested_matches: any[] | null
  created_at: string
}

interface SpotifyTrack {
  id: string
  name: string
  artist: string
  album: string
  image: string
  preview_url: string | null
  url: string
  duration_ms: number
  duration_formatted: string
  popularity: number
  explicit: boolean
}

interface Label {
  id: string
  name: string
  slug: string
  primary_genre: string
  cataloged_tracks: number
  created_at: string
}

interface LabelDNA {
  totalTracks: number
  analyzedTracks: number
  matchedTracks: number
  needsReviewTracks: number
  failedTracks: number
  
  // Qualità dati
  hasAudioAnalysis: number
  hasPreview: number
  
  // Metriche
  averageConfidence: number
  coverageScore: number // 0-100
  qualityScore: number // 0-100
  
  // Stato DNA
  dnaStatus: 'incomplete' | 'building' | 'ready' | 'excellent'
  dnaProgress: number // 0-100
  
  // Dettagli
  uniqueArtists: number
  avgTrackDuration: number | null
  releaseYearRange: { min: number; max: number } | null
}

export default function LabelDetailPage() {
  const params = useParams()
  const labelId = params.id as string
  
  const [label, setLabel] = useState<Label | null>(null)
  const [tracks, setTracks] = useState<Track[]>([])
  const [dna, setDna] = useState<LabelDNA | null>(null)
  const [rawText, setRawText] = useState('')
  const [parsedCount, setParsedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'dna' | 'tracks' | 'add' | 'verify'>('dna')
  const [processing, setProcessing] = useState(false)
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null)
  
  // Modal dettagli traccia
  const [showTrackModal, setShowTrackModal] = useState(false)
  const [modalTrack, setModalTrack] = useState<Track | null>(null)
  
  // Ricerca manuale Spotify
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SpotifyTrack[]>([])
  const [searching, setSearching] = useState(false)
  const [showSearchPanel, setShowSearchPanel] = useState(false)

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
        calculateDNA(tracksData.tracks || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateDNA = (trackList: Track[]) => {
    const total = trackList.length
    const matched = trackList.filter(t => t.status === 'matched').length
    const needsReview = trackList.filter(t => t.status === 'needs_review').length
    const failed = trackList.filter(t => t.status === 'failed').length
    const pending = trackList.filter(t => t.status === 'pending').length
    const analyzed = matched + needsReview + failed
    
    const withPreview = trackList.filter(t => t.spotify_preview_url).length
    
    // Calcola confidence media
    const confidences = trackList
      .filter(t => t.spotify_match_confidence)
      .map(t => t.spotify_match_confidence)
    const avgConfidence = confidences.length > 0 
      ? confidences.reduce((a, b) => a + b, 0) / confidences.length 
      : 0
    
    // Artisti unici
    const artists = new Set(trackList.map(t => t.artist_name).filter(Boolean))
    
    // Score copertura (quante tracce hanno match)
    const coverageScore = total > 0 ? Math.round((matched / total) * 100) : 0
    
    // Score qualità (confidence media)
    const qualityScore = Math.round(avgConfidence * 100)
    
    // Stato DNA
    let dnaStatus: LabelDNA['dnaStatus'] = 'incomplete'
    let dnaProgress = 0
    
    if (total >= 50 && coverageScore >= 80 && qualityScore >= 80) {
      dnaStatus = 'excellent'
      dnaProgress = 100
    } else if (total >= 20 && coverageScore >= 60 && qualityScore >= 60) {
      dnaStatus = 'ready'
      dnaProgress = 75
    } else if (total >= 10 && coverageScore >= 40) {
      dnaStatus = 'building'
      dnaProgress = 50
    } else {
      dnaStatus = 'incomplete'
      dnaProgress = Math.round((total / 20) * 50)
    }
    
    setDna({
      totalTracks: total,
      analyzedTracks: analyzed,
      matchedTracks: matched,
      needsReviewTracks: needsReview,
      failedTracks: failed,
      hasAudioAnalysis: matched,
      hasPreview: withPreview,
      averageConfidence: avgConfidence,
      coverageScore,
      qualityScore,
      dnaStatus,
      dnaProgress,
      uniqueArtists: artists.size,
      avgTrackDuration: null,
      releaseYearRange: null
    })
  }

  const getStatusColor = (status: LabelDNA['dnaStatus']) => {
    switch (status) {
      case 'excellent': return 'text-emerald-400 border-emerald-500 bg-emerald-900/20'
      case 'ready': return 'text-blue-400 border-blue-500 bg-blue-900/20'
      case 'building': return 'text-yellow-400 border-yellow-500 bg-yellow-900/20'
      case 'incomplete': return 'text-red-400 border-red-500 bg-red-900/20'
    }
  }

  const getStatusLabel = (status: LabelDNA['dnaStatus']) => {
    switch (status) {
      case 'excellent': return '🌟 Eccellente'
      case 'ready': return '✅ Pronto'
      case 'building': return '🔧 In costruzione'
      case 'incomplete': return '⚠️ Incompleto'
    }
  }

  // ... resto del componente (parseText, extractTracks, addTracks, startMatching)
  const parseText = () => {
    const lines = rawText.split('\n').filter(l => l.trim().length > 0)
    let count = 0
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length < 3) continue
      
      if (trimmed.match(/^(.+?)\s*[-–—]\s*(.+)/)) {
        count++
      } else if (trimmed.match(/(.+?)\s+(Original Mix|Extended Mix|Remix|Edit)\s+(.+)/i)) {
        count++
      } else if (trimmed.split(/\s+/).length >= 3) {
        count++
      }
    }
    
    setParsedCount(count)
  }

  const extractTracks = (text: string) => {
    const lines = text.split('\n')
    const tracks: { artist: string; title: string }[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length < 3) continue
      
      const dashMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/)
      if (dashMatch) {
        tracks.push({
          artist: dashMatch[1].trim(),
          title: dashMatch[2].trim()
        })
        continue
      }
      
      const mixMatch = trimmed.match(/^(.+?)\s+(Original Mix|Extended Mix|Club Mix|Radio Edit|Remix|Edit)\s+(.+)$/i)
      if (mixMatch) {
        tracks.push({
          artist: mixMatch[3].trim(),
          title: `${mixMatch[1].trim()} ${mixMatch[2].trim()}`
        })
        continue
      }
      
      const parenMatch = trimmed.match(/^(.+?)\s*[\(\[](.+?)[\)\]]\s*(.+)$/)
      if (parenMatch) {
        tracks.push({
          artist: parenMatch[3].trim(),
          title: `${parenMatch[1].trim()} (${parenMatch[2].trim()})`
        })
        continue
      }
      
      const words = trimmed.split(/\s+/)
      if (words.length >= 2) {
        const artist = words.slice(-2).join(' ')
        const title = words.slice(0, -2).join(' ')
        if (title && artist) {
          tracks.push({ artist, title })
        }
      }
    }
    
    return tracks
  }

  const addTracks = async () => {
    if (!rawText.trim() || parsedCount === 0) return
    
    setProcessing(true)
    
    const tracksToAdd = extractTracks(rawText)
    
    if (tracksToAdd.length === 0) {
      setProcessing(false)
      return
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
        setActiveTab('dna')
        fetchLabelData()
      }
    } catch (error) {
      console.error('Error adding tracks:', error)
    } finally {
      setProcessing(false)
    }
  }

  const startMatching = async () => {
    if (!dna || dna.matchedTracks + dna.needsReviewTracks + dna.failedTracks === 0) return
    
    setProcessing(true)
    
    try {
      await fetch('/api/admin/process-ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: labelId, batch_size: 5 })
      })
      
      const interval = setInterval(async () => {
        await fetchLabelData()
      }, 5000)
      
      setTimeout(() => {
        clearInterval(interval)
        setProcessing(false)
      }, 120000)
      
    } catch (error) {
      console.error('Error starting matching:', error)
      setProcessing(false)
    }
  }

  const verifyTrack = async (trackId: string, isCorrect: boolean) => {
    try {
      await fetch('/api/admin/verify-track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: trackId,
          is_correct: isCorrect
        })
      })
      
      fetchLabelData()
      setSelectedTrack(null)
    } catch (error) {
      console.error('Error verifying track:', error)
    }
  }

  // Apri modal con dettagli traccia
  const openTrackModal = (track: Track) => {
    setModalTrack(track)
    setShowTrackModal(true)
    setShowSearchPanel(false)
    setSearchResults([])
    setSearchQuery(`${track.artist_name} ${track.track_title}`)
  }

  // Chiudi modal
  const closeTrackModal = () => {
    setShowTrackModal(false)
    setModalTrack(null)
    setShowSearchPanel(false)
    setSearchResults([])
  }

  // Cerca tracce su Spotify
  const searchSpotify = async () => {
    if (!searchQuery.trim() || searchQuery.length < 3) return
    
    setSearching(true)
    try {
      const response = await fetch(`/api/admin/search-spotify?q=${encodeURIComponent(searchQuery)}`)
      const data = await response.json()
      if (response.ok) {
        setSearchResults(data.tracks || [])
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
    }
  }

  // Aggiorna match manuale
  const updateManualMatch = async (spotifyTrack: SpotifyTrack) => {
    if (!modalTrack) return
    
    try {
      const response = await fetch('/api/admin/update-track-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: modalTrack.id,
          spotify_track_id: spotifyTrack.id,
          spotify_track_name: spotifyTrack.name,
          spotify_artist_name: spotifyTrack.artist,
          spotify_url: spotifyTrack.url,
          spotify_album_name: spotifyTrack.album,
          spotify_album_image: spotifyTrack.image,
          spotify_preview_url: spotifyTrack.preview_url,
          spotify_duration_ms: spotifyTrack.duration_ms,
          spotify_popularity: spotifyTrack.popularity,
          notes: 'Correzione manuale'
        })
      })
      
      if (response.ok) {
        fetchLabelData()
        closeTrackModal()
      }
    } catch (error) {
      console.error('Error updating match:', error)
    }
  }

  // Formatta durata
  const formatDuration = (ms: number | null) => {
    if (!ms) return '--:--'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-white">Caricamento...</div>
  }

  if (!label || !dna) {
    return <div className="min-h-screen bg-black p-8 text-white">Label non trovata</div>
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <a href="/admin/labels" className="text-sm text-zinc-500 hover:text-white">← Torna alle label</a>
          <h1 className="mt-2 text-2xl font-bold text-white">{label.name}</h1>
          <p className="text-zinc-500">{label.primary_genre} • {dna.totalTracks} tracce • {dna.uniqueArtists} artisti</p>
        </div>

        {/* DNA Status Card */}
        <div className={`mb-8 rounded-lg border-2 p-6 ${getStatusColor(dna.dnaStatus)}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">{getStatusLabel(dna.dnaStatus)}</h2>
              <p className="mt-1 text-sm opacity-80">
                {dna.dnaStatus === 'excellent' && 'Il profilo label è completo e altamente affidabile per il matching'}
                {dna.dnaStatus === 'ready' && 'Il profilo è pronto per essere usato, ma può essere migliorato'}
                {dna.dnaStatus === 'building' && 'Il profilo è in costruzione, aggiungi più tracce'}
                {dna.dnaStatus === 'incomplete' && 'Profilo incompleto, servono più dati per matching affidabile'}
              </p>
            </div>
            <div className="text-right">
              <p className="text-3xl font-bold">{dna.dnaProgress}%</p>
              <p className="text-sm opacity-80">Completamento</p>
            </div>
          </div>
          
          <div className="mt-4 h-2 rounded-full bg-black/30">
            <div 
              className="h-2 rounded-full bg-current transition-all"
              style={{ width: `${dna.dnaProgress}%` }}
            />
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg bg-zinc-900/50 p-4 text-center">
            <p className="text-2xl font-bold text-white">{dna.totalTracks}</p>
            <p className="text-xs text-zinc-500">Tracce Totali</p>
          </div>
          
          <div className="rounded-lg bg-emerald-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-400">{dna.matchedTracks}</p>
            <p className="text-xs text-zinc-500">✓ Match Perfetti</p>
          </div>
          
          <div className="rounded-lg bg-yellow-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">{dna.needsReviewTracks}</p>
            <p className="text-xs text-zinc-500">⚠️ Da Verificare</p>
          </div>
          
          <div className="rounded-lg bg-red-900/20 p-4 text-center">
            <p className="text-2xl font-bold text-red-400">{dna.failedTracks}</p>
            <p className="text-xs text-zinc-500">✗ Non Trovati</p>
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm text-zinc-500">Copertura Dati</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-white">{dna.coverageScore}%</p>
              <p className="text-xs text-zinc-500">{dna.matchedTracks}/{dna.totalTracks} tracce</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${dna.coverageScore}%` }} />
            </div>
          </div>
          
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm text-zinc-500">Qualità Matching</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-white">{dna.qualityScore}%</p>
              <p className="text-xs text-zinc-500">Confidence media</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${dna.qualityScore}%` }} />
            </div>
          </div>
          
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <p className="text-sm text-zinc-500">Audio Disponibile</p>
            <div className="mt-2 flex items-end justify-between">
              <p className="text-3xl font-bold text-white">{dna.hasPreview}</p>
              <p className="text-xs text-zinc-500">Preview Spotify</p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-zinc-800">
              <div 
                className="h-2 rounded-full bg-purple-500" 
                style={{ width: `${dna.totalTracks > 0 ? (dna.hasPreview / dna.totalTracks) * 100 : 0}%` }} 
              />
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-4 border-b border-zinc-800">
          <button
            onClick={() => setActiveTab('dna')}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'dna' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            🧬 DNA Label
          </button>
          <button
            onClick={() => setActiveTab('tracks')}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'tracks' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            📋 Lista Tracce ({dna.totalTracks})
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'verify' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            ⚠️ Da Verificare ({dna.needsReviewTracks})
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
        {activeTab === 'dna' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 font-semibold text-white">Analisi DNA Label</h2>
            
            <div className="space-y-4">
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Stato Profilo</span>
                <span className={dna.dnaStatus === 'excellent' ? 'text-emerald-400' : dna.dnaStatus === 'ready' ? 'text-blue-400' : 'text-yellow-400'}>
                  {getStatusLabel(dna.dnaStatus)}
                </span>
              </div>
              
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Tracce Analizzate</span>
                <span className="text-white">{dna.analyzedTracks} / {dna.totalTracks}</span>
              </div>
              
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Artisti Unici</span>
                <span className="text-white">{dna.uniqueArtists}</span>
              </div>
              
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Confidence Media</span>
                <span className={dna.averageConfidence >= 0.8 ? 'text-emerald-400' : dna.averageConfidence >= 0.6 ? 'text-yellow-400' : 'text-red-400'}>
                  {(dna.averageConfidence * 100).toFixed(0)}%
                </span>
              </div>
              
              <div className="flex justify-between border-b border-zinc-800 pb-2">
                <span className="text-zinc-400">Preview Audio</span>
                <span className="text-white">{dna.hasPreview} / {dna.totalTracks}</span>
              </div>
              
              <div className="mt-6 rounded-lg bg-zinc-950 p-4">
                <p className="text-sm text-zinc-400">
                  <strong className="text-white">Cosa significa:</strong>
                </p>
                <ul className="mt-2 space-y-1 text-sm text-zinc-500">
                  <li>• <strong>Copertura Dati:</strong> Percentuale di tracce con match Spotify trovato</li>
                  <li>• <strong>Qualità Matching:</strong> Affidabilità media delle corrispondenze trovate</li>
                  <li>• <strong>DNA Pronto:</strong> Il profilo è sufficiente per matching con tracce utente</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'tracks' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-white">Lista Tracce</h2>
              {dna.matchedTracks + dna.needsReviewTracks + dna.failedTrack > 0 && (
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
                      <tr 
                        key={track.id} 
                        className="cursor-pointer hover:bg-zinc-800/50"
                        onClick={() => openTrackModal(track)}
                      >
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
        )}

        {activeTab === 'verify' && (
          <div>
            <h2 className="mb-4 font-semibold text-white">Tracce da Verificare</h2>
            
            {tracks.filter(t => t.status === 'needs_review').length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <p className="text-zinc-500">🎉 Nessuna traccia da verificare!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {tracks
                  .filter(t => t.status === 'needs_review')
                  .map((track) => (
                    <div 
                      key={track.id} 
                      className="cursor-pointer rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 hover:border-zinc-700"
                      onClick={() => openTrackModal(track)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-white">{track.artist_name} - {track.track_title}</p>
                          <p className="text-sm text-zinc-500">Confidence: {(track.spotify_match_confidence || 0) * 100}%</p>
                        </div>
                        
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => verifyTrack(track.id, true)}
                            className="rounded bg-emerald-900/50 px-3 py-1 text-sm text-emerald-400 hover:bg-emerald-900"
                          >
                            ✓ Conferma
                          </button>
                          <button
                            onClick={() => verifyTrack(track.id, false)}
                            className="rounded bg-red-900/50 px-3 py-1 text-sm text-red-400 hover:bg-red-900"
                          >
                            ✗ Rifiuta
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'add' && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="mb-4 font-semibold text-white">Aggiungi Tracce</h2>
            
            <p className="mb-4 text-sm text-zinc-400">
              Incolla la lista tracce da Beatport/Traxsource
            </p>
            
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="mb-4 h-48 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white font-mono text-sm"
              placeholder="Adam Beyer - Your Mind&#10;Cut The Noise Original Mix Fer BR&#10;..."
            />
            
            <div className="flex items-center gap-4">
              <button
                onClick={parseText}
                disabled={!rawText.trim()}
                className="rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-zinc-600 disabled:opacity-50"
              >
                🔍 Analizza Testo
              </button>
              
              {parsedCount > 0 && (
                <p className="text-sm text-emerald-400">
                  {parsedCount} tracce riconosciute
                </p>
              )}
            </div>
            
            {parsedCount > 0 && (
              <button
                onClick={addTracks}
                disabled={processing}
                className="mt-4 rounded-lg bg-emerald-500 px-6 py-3 font-semibold text-black hover:bg-emerald-400 disabled:opacity-50"
              >
                {processing ? 'Aggiungendo...' : `Aggiungi ${parsedCount} Tracce`}
              </button>
            )}
          </div>
        )}

        {/* Modal Dettagli Traccia */}
        {showTrackModal && modalTrack && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
            <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-lg border border-zinc-700 bg-zinc-900">
              {/* Header */}
              <div className="sticky top-0 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-4">
                <h3 className="text-lg font-bold text-white">Dettagli Traccia</h3>
                <button
                  onClick={closeTrackModal}
                  className="rounded p-1 text-zinc-400 hover:bg-zinc-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <div className="p-6">
                {/* Confronto titoli */}
                <div className="mb-6 grid grid-cols-2 gap-4">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-2 text-xs uppercase text-zinc-500">Originale (inserito)</p>
                    <p className="font-medium text-white">{modalTrack.artist_name}</p>
                    <p className="text-zinc-400">{modalTrack.track_title}</p>
                  </div>
                  
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <p className="mb-2 text-xs uppercase text-zinc-500">Spotify Match</p>
                    {modalTrack.spotify_track_id ? (
                      <>
                        <p className="font-medium text-white">{modalTrack.spotify_artist_name}</p>
                        <p className="text-zinc-400">{modalTrack.spotify_track_name}</p>
                      </>
                    ) : (
                      <p className="text-zinc-500">Nessun match trovato</p>
                    )}
                  </div>
                </div>

                {/* Dettagli Spotify */}
                {modalTrack.spotify_track_id && (
                  <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                    <div className="flex gap-4">
                      {modalTrack.spotify_album_image && (
                        <img
                          src={modalTrack.spotify_album_image}
                          alt="Album"
                          className="h-24 w-24 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <p className="text-sm text-zinc-500">Album</p>
                        <p className="text-white">{modalTrack.spotify_album_name}</p>
                        
                        <div className="mt-2 flex gap-4 text-sm">
                          <span className="text-zinc-400">
                            Durata: {formatDuration(modalTrack.spotify_duration_ms)}
                          </span>
                          <span className="text-zinc-400">
                            Confidence: {Math.round((modalTrack.spotify_match_confidence || 0) * 100)}%
                          </span>
                        </div>

                        {modalTrack.spotify_url && (
                          <a
                            href={modalTrack.spotify_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-2 inline-flex items-center gap-2 rounded bg-emerald-500 px-3 py-1.5 text-sm font-medium text-black hover:bg-emerald-400"
                          >
                            🎵 Apri su Spotify
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Pulsanti azione */}
                <div className="mb-6 flex gap-3">
                  <button
                    onClick={() => setShowSearchPanel(!showSearchPanel)}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-500"
                  >
                    🔍 Cerca Alternativa
                  </button>
                  
                  {modalTrack.status === 'needs_review' && (
                    <>
                      <button
                        onClick={() => {
                          verifyTrack(modalTrack.id, true)
                          closeTrackModal()
                        }}
                        className="rounded-lg bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500"
                      >
                        ✓ Conferma Match
                      </button>
                      <button
                        onClick={() => {
                          verifyTrack(modalTrack.id, false)
                          closeTrackModal()
                        }}
                        className="rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-500"
                      >
                        ✗ Rifiuta
                      </button>
                    </>
                  )}
                </div>

                {/* Pannello ricerca */}
                {showSearchPanel && (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-4">
                    <h4 className="mb-3 font-medium text-white">Cerca su Spotify</h4>
                    
                    <div className="mb-4 flex gap-2">
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && searchSpotify()}
                        className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-white"
                        placeholder="Artista - Titolo"
                      />
                      <button
                        onClick={searchSpotify}
                        disabled={searching || searchQuery.length < 3}
                        className="rounded bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-500 disabled:opacity-50"
                      >
                        {searching ? '...' : 'Cerca'}
                      </button>
                    </div>

                    {/* Risultati ricerca */}
                    {searchResults.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm text-zinc-500">{searchResults.length} risultati:</p>
                        {searchResults.map((track) => (
                          <div
                            key={track.id}
                            className="flex items-center gap-3 rounded border border-zinc-800 bg-zinc-900 p-3 hover:border-zinc-600"
                          >
                            {track.image ? (
                              <img src={track.image} alt="" className="h-12 w-12 rounded object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-zinc-600">
                                🎵
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-white">{track.name}</p>
                              <p className="truncate text-sm text-zinc-400">{track.artist}</p>
                              <p className="truncate text-xs text-zinc-500">{track.album}</p>
                            </div>
                            
                            <div className="text-right text-sm text-zinc-500">
                              <p>{track.duration_formatted}</p>
                              <p>♥ {track.popularity}</p>
                            </div>
                            
                            <button
                              onClick={() => updateManualMatch(track)}
                              className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500"
                            >
                              Usa questo
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Match suggeriti (se presenti) */}
                    {modalTrack.suggested_matches && modalTrack.suggested_matches.length > 0 && !searchResults.length && (
                      <div className="mt-4 space-y-2">
                        <p className="text-sm text-zinc-500">Match suggeriti dal sistema:</p>
                        {modalTrack.suggested_matches.map((track: any, idx: number) => (
                          <div
                            key={track.id || idx}
                            className="flex items-center gap-3 rounded border border-yellow-900/50 bg-yellow-950/20 p-3"
                          >
                            {track.image ? (
                              <img src={track.image} alt="" className="h-12 w-12 rounded object-cover" />
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-zinc-600">
                                🎵
                              </div>
                            )}
                            
                            <div className="flex-1 min-w-0">
                              <p className="truncate font-medium text-white">{track.name}</p>
                              <p className="truncate text-sm text-zinc-400">{track.artist}</p>
                            </div>
                            
                            <button
                              onClick={() => updateManualMatch(track as SpotifyTrack)}
                              className="rounded bg-yellow-600 px-3 py-1.5 text-sm text-white hover:bg-yellow-500"
                            >
                              Usa questo
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
