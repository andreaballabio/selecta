'use client'

import { useState, useEffect, useRef } from 'react'
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
  // Analisi audio
  analysis_status: string
  bpm: number | null
  key: string | null
  scale: string | null
  energy: number | null
  lufs: number | null
  duration: number | null
  audio_embedding: number[] | null
  // Nuovi campi multi-source
  audio_source: 'deezer' | 'spotify' | null
  audio_preview_url: string | null
  track_rank: number | null
  track_explicit: boolean | null
  track_genre: string | null
  release_date: string | null
  // Nuovi campi stilistici
  onset_strength: number | null
  sub_ratio: number | null
  mid_presence: number | null
  tempo_stability: number | null
  spectral_contrast: number | null
}

interface UnifiedTrack {
  id: string
  name: string
  artist: string
  album: string
  image: string | null
  preview_url: string | null
  url: string
  duration_ms: number
  duration_formatted: string
  rank: number
  explicit: boolean
  source: 'deezer' | 'spotify'
  release_date?: string
  genre?: string
  contributors?: string[]
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
  const [activeTab, setActiveTab] = useState<'dna' | 'tracks' | 'add' | 'verify' | 'tinder'>('dna')
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
  
  // Stati per il processing batch
  const [countdown, setCountdown] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const batchTimerRef = useRef<NodeJS.Timeout | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)
  
  // Stati per verifica Tinder-style
  const [pendingTracks, setPendingTracks] = useState<any[]>([])
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0)
  const [verifying, setVerifying] = useState(false)
  const [verifiedCount, setVerifiedCount] = useState(0)
  const [rejectedCount, setRejectedCount] = useState(0)

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
    const withAudioAnalysis = trackList.filter(t => t.analysis_status === 'analyzed').length
    
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
    
    if (total >= 50 && coverageScore >= 80 && qualityScore >= 80 && withAudioAnalysis >= matched * 0.8) {
      dnaStatus = 'excellent'
      dnaProgress = 100
    } else if (total >= 20 && coverageScore >= 60 && qualityScore >= 60 && withAudioAnalysis >= matched * 0.5) {
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
      hasAudioAnalysis: withAudioAnalysis,
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

  // Funzione per pulire il titolo dai suffissi di mix/edit
  const cleanTrackTitle = (title: string): string => {
    // Pattern per rimuovere: Original Mix, Extended Mix, Radio Edit, Club Mix, Remix, Edit, etc.
    const mixPatterns = [
      /\s*[-–—]?\s*\(?\s*(Original Mix|Extended Mix|Radio Edit|Club Mix|Remix|Edit|Mix|Version|Vocal Mix|Dub Mix|Instrumental|Acapella)\s*\)?$/i,
      /\s*[-–—]?\s*\(?\s*(Original|Extended|Radio|Club|Vocal|Dub)\s*\)?$/i,
      /\s*\(?\s*(feat\.?\s+[^)]+)\s*\)?/i, // Rimuovi feat. per la ricerca (ma li teniamo separati)
    ]
    
    let cleaned = title
    for (const pattern of mixPatterns) {
      cleaned = cleaned.replace(pattern, '').trim()
    }
    
    // Rimuovi spazi multipli
    cleaned = cleaned.replace(/\s+/g, ' ').trim()
    
    return cleaned
  }

  const extractTracks = (text: string) => {
    const lines = text.split('\n')
    const tracks: { artist: string; title: string; originalTitle: string }[] = []
    
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.length < 3) continue
      
      let artist = ''
      let title = ''
      
      // Pattern: Artista - Titolo (Mix)
      const dashMatch = trimmed.match(/^(.+?)\s*[-–—]\s*(.+?)(?:\s*[\(\[]|$)/)
      if (dashMatch) {
        artist = dashMatch[1].trim()
        title = dashMatch[2].trim()
      } else {
        // Pattern: Titolo (Mix) Artista
        const mixMatch = trimmed.match(/^(.+?)\s+(Original Mix|Extended Mix|Club Mix|Radio Edit|Remix|Edit)\s+(.+)$/i)
        if (mixMatch) {
          artist = mixMatch[3].trim()
          title = `${mixMatch[1].trim()} ${mixMatch[2].trim()}`
        } else {
          // Pattern: Parole con artista alla fine
          const words = trimmed.split(/\s+/)
          if (words.length >= 2) {
            artist = words.slice(-2).join(' ')
            title = words.slice(0, -2).join(' ')
          }
        }
      }
      
      if (artist && title) {
        // Salva il titolo originale per riferimento
        const originalTitle = title
        // Pulisci il titolo per la ricerca
        const cleanedTitle = cleanTrackTitle(title)
        
        tracks.push({ 
          artist, 
          title: cleanedTitle,
          originalTitle
        })
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

  const startAudioAnalysis = async () => {
    if (!dna) return
    
    const pendingAnalysis = tracks.filter(t => t.status === 'matched' && (t.analysis_status === 'pending' || !t.analysis_status)).length
    if (pendingAnalysis === 0) return
    
    setProcessing(true)
    setIsPaused(false)
    
    try {
      // Processa la prima traccia immediatamente
      await analyzeNextTrack()
      
      // Avvia il timer per le tracce successive (30 secondi di intervallo)
      startAnalysisTimer()
      
    } catch (error) {
      console.error('Error starting audio analysis:', error)
      setProcessing(false)
    }
  }

  // Analizza la prossima traccia
  const analyzeNextTrack = async () => {
    try {
      const response = await fetch('/api/admin/analyze-audio', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: labelId })
      })
      
      const data = await response.json()
      
      // Aggiorna i dati
      await fetchLabelData()
      
      // Controlla se ci sono ancora tracce da analizzare
      // Usa i dati aggiornati dalla fetch, non lo stato stale
      if (data.done || data.message === 'Nessuna traccia da analizzare') {
        // Fine analisi
        setProcessing(false)
        setCountdown(0)
        setIsPaused(false)
        if (batchTimerRef.current) {
          clearInterval(batchTimerRef.current)
          batchTimerRef.current = null
        }
        if (countdownRef.current) {
          clearInterval(countdownRef.current)
          countdownRef.current = null
        }
        return false // Non ci sono più tracce
      }
      
      if (!data.success) {
        console.error('Analysis failed:', data.error)
      }
      
      return true // C'è stata una traccia processata
    } catch (error) {
      console.error('Error analyzing track:', error)
      throw error
    }
  }

  // Timer per l'analisi (30 secondi tra una traccia e l'altra)
  const ANALYSIS_INTERVAL = 30

  const startAnalysisTimer = () => {
    // Pulisci timer precedenti
    if (batchTimerRef.current) clearInterval(batchTimerRef.current)
    if (countdownRef.current) clearInterval(countdownRef.current)
    
    setCountdown(ANALYSIS_INTERVAL)
    
    // Timer per il countdown visivo
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)
    
    // Timer per analizzare la prossima traccia
    batchTimerRef.current = setInterval(async () => {
      if (isPaused) return
      
      // Analizza prossima traccia e controlla se è finita
      const hasMore = await analyzeNextTrack()
      
      if (!hasMore) {
        // Fine, non ci sono più tracce
        return
      }
      
      // Reset countdown per la prossima
      setCountdown(ANALYSIS_INTERVAL)
    }, ANALYSIS_INTERVAL * 1000)
  }

  // Mantieni startMatching per compatibilità (ora reindirizza a startAudioAnalysis)
  const startMatching = async () => {
    // Questa funzione esiste per non rompere eventuali riferimenti
    // ma l'utente dovrebbe usare la verifica Tinder-style per i match
    console.log('Usa la tab "Verifica Match" per i nuovi match')
  }

  // Pausa/Riprendi
  const togglePause = () => {
    setIsPaused(prev => !prev)
  }

  // Ferma completamente
  const stopProcessing = () => {
    setProcessing(false)
    setCountdown(0)
    setIsPaused(false)
    if (batchTimerRef.current) {
      clearInterval(batchTimerRef.current)
      batchTimerRef.current = null
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }
  }

  // Cleanup quando il componente si smonta
  useEffect(() => {
    return () => {
      if (batchTimerRef.current) clearInterval(batchTimerRef.current)
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [])

  // ==================== VERIFICA TINDER-STYLE ====================
  
  // Carica tracce pending per verifica
  const loadPendingTracks = async () => {
    setVerifying(true)
    setCurrentTrackIndex(0)
    setVerifiedCount(0)
    setRejectedCount(0)
    
    try {
      const response = await fetch(`/api/admin/verify-matches?label_id=${labelId}`)
      const data = await response.json()
      
      if (response.ok) {
        setPendingTracks(data.tracks || [])
        if (data.tracks?.length === 0) {
          alert('Nessuna traccia da verificare!')
          setActiveTab('tracks')
        }
      } else {
        alert('Errore caricamento tracce: ' + data.error)
      }
    } catch (error) {
      console.error('Error loading pending tracks:', error)
      alert('Errore caricamento tracce')
    } finally {
      setVerifying(false)
    }
  }
  
  // Conferma match corrente
  const confirmCurrentMatch = async (spotifyTrack: any) => {
    const currentTrack = pendingTracks[currentTrackIndex]
    if (!currentTrack) return
    
    try {
      const response = await fetch('/api/admin/verify-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: currentTrack.id,
          action: 'confirm',
          spotify_track: spotifyTrack
        })
      })
      
      if (response.ok) {
        setVerifiedCount(prev => prev + 1)
        nextTrack()
      } else {
        const error = await response.json()
        alert('Errore: ' + error.error)
      }
    } catch (error) {
      console.error('Error confirming match:', error)
    }
  }
  
  // Rifiuta match corrente
  const rejectCurrentMatch = async () => {
    const currentTrack = pendingTracks[currentTrackIndex]
    if (!currentTrack) return
    
    try {
      const response = await fetch('/api/admin/verify-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: currentTrack.id,
          action: 'reject'
        })
      })
      
      if (response.ok) {
        setRejectedCount(prev => prev + 1)
        nextTrack()
      } else {
        const error = await response.json()
        alert('Errore: ' + error.error)
      }
    } catch (error) {
      console.error('Error rejecting match:', error)
    }
  }
  
  // Salta traccia corrente
  const skipCurrentTrack = () => {
    nextTrack()
  }
  
  // Passa alla traccia successiva
  const nextTrack = () => {
    if (currentTrackIndex < pendingTracks.length - 1) {
      setCurrentTrackIndex(prev => prev + 1)
    } else {
      // Fine verifica
      alert(`Verifica completata!\n✓ Confermate: ${verifiedCount + 1}\n✗ Rifiutate: ${rejectedCount}`)
      setActiveTab('tracks')
      fetchLabelData()
    }
  }
  
  // Torna alla traccia precedente
  const prevTrack = () => {
    if (currentTrackIndex > 0) {
      setCurrentTrackIndex(prev => prev - 1)
    }
  }
  
  // Cerca alternativa per la traccia corrente (usa nuova API multi-source)
  const searchAlternative = async (query: string) => {
    if (!query.trim() || query.length < 3) return
    
    setSearching(true)
    try {
      // Usa la nuova API che cerca su Deezer (primario) e Spotify (fallback)
      const response = await fetch(`/api/admin/search-tracks?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      if (response.ok && data.tracks) {
        // Aggiorna i proposed_matches della traccia corrente
        setPendingTracks(prev => {
          const updated = [...prev]
          updated[currentTrackIndex] = {
            ...updated[currentTrackIndex],
            proposed_matches: data.tracks.map((t: UnifiedTrack) => ({
              id: t.id,
              name: t.name,
              artist: t.artist,
              album: t.album,
              image: t.image,
              preview_url: t.preview_url,
              url: t.url,
              duration_ms: t.duration_ms,
              duration_formatted: t.duration_formatted,
              rank: t.rank,
              explicit: t.explicit,
              source: t.source,
              release_date: t.release_date,
              genre: t.genre
            }))
          }
          return updated
        })
      }
    } catch (error) {
      console.error('Search error:', error)
    } finally {
      setSearching(false)
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

  // Elimina traccia
  const deleteTrack = async (trackId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa traccia?')) return
    
    try {
      const response = await fetch(`/api/admin/track?id=${trackId}`, {
        method: 'DELETE'
      })
      
      if (response.ok) {
        fetchLabelData()
        closeTrackModal()
      } else {
        const error = await response.json()
        alert('Errore: ' + error.error)
      }
    } catch (error) {
      console.error('Error deleting track:', error)
      alert('Errore durante l\'eliminazione')
    }
  }

  // Reset traccia per rianalisi
  const resetTrack = async (trackId: string) => {
    if (!confirm('Resettare questa traccia per una nuova analisi?')) return
    
    try {
      const response = await fetch('/api/admin/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: trackId, action: 'reset' })
      })
      
      if (response.ok) {
        fetchLabelData()
        closeTrackModal()
      } else {
        const error = await response.json()
        alert('Errore: ' + error.error)
      }
    } catch (error) {
      console.error('Error resetting track:', error)
      alert('Errore durante il reset')
    }
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
            onClick={() => {
              setActiveTab('tinder')
              loadPendingTracks()
            }}
            className={`pb-3 text-sm font-medium ${
              activeTab === 'tinder' 
                ? 'border-b-2 border-emerald-500 text-emerald-400' 
                : 'text-zinc-500 hover:text-white'
            }`}
          >
            🎯 Verifica Match
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
              
              {/* Statistiche Avanzate per Matching */}
              <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
                <h3 className="mb-3 font-medium text-white">📊 Statistiche per Matching</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="rounded bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Tracce con Preview</p>
                    <p className="text-xl font-bold text-emerald-400">
                      {dna.totalTracks > 0 ? Math.round((dna.hasPreview / dna.totalTracks) * 100) : 0}%
                    </p>
                  </div>
                  
                  <div className="rounded bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Match Perfetti</p>
                    <p className="text-xl font-bold text-blue-400">
                      {dna.totalTracks > 0 ? Math.round((dna.matchedTracks / dna.totalTracks) * 100) : 0}%
                    </p>
                  </div>
                  
                  <div className="rounded bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Da Verificare</p>
                    <p className="text-xl font-bold text-yellow-400">{dna.needsReviewTracks}</p>
                  </div>
                  
                  <div className="rounded bg-zinc-900 p-3">
                    <p className="text-xs text-zinc-500">Non Trovati</p>
                    <p className="text-xl font-bold text-red-400">{dna.failedTracks}</p>
                  </div>
                </div>
                
                <div className="mt-4 border-t border-zinc-800 pt-4">
                  <h4 className="mb-2 text-sm font-medium text-white">Qualità del Dataset</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Copertura Spotify</span>
                      <span className={dna.coverageScore >= 70 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {dna.coverageScore}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-1.5 rounded-full bg-emerald-500" style={{ width: `${dna.coverageScore}%` }} />
                    </div>
                    
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-zinc-400">Affidabilità Media</span>
                      <span className={dna.qualityScore >= 70 ? 'text-emerald-400' : 'text-yellow-400'}>
                        {dna.qualityScore}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-zinc-800">
                      <div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${dna.qualityScore}%` }} />
                    </div>
                  </div>
                </div>
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
              
              {!processing ? (
                <div className="flex items-center gap-3">
                  {/* Contatori */}
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <span className="text-emerald-400">✓ {dna.hasAudioAnalysis} analizzate</span>
                    <span>|</span>
                    <span className="text-yellow-400">
                      ⏳ {tracks.filter(t => t.status === 'matched' && (t.analysis_status === 'pending' || !t.analysis_status)).length} da analizzare
                    </span>
                  </div>
                  
                  <button
                    onClick={startAudioAnalysis}
                    disabled={tracks.filter(t => t.status === 'matched' && (t.analysis_status === 'pending' || !t.analysis_status)).length === 0}
                    className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50"
                  >
                    🔬 Avvia Analisi Audio
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Countdown */}
                  <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2">
                    <span className="text-sm text-zinc-400">Prossima traccia:</span>
                    <span className="text-lg font-bold text-purple-400">
                      {isPaused ? '⏸️ PAUSA' : `${countdown}s`}
                    </span>
                  </div>
                  
                  {/* Pulsante Pausa/Riprendi */}
                  <button
                    onClick={togglePause}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold ${
                      isPaused 
                        ? 'bg-emerald-600 text-white hover:bg-emerald-500' 
                        : 'bg-yellow-600 text-white hover:bg-yellow-500'
                    }`}
                  >
                    {isPaused ? '▶️ Riprendi' : '⏸️ Pausa'}
                  </button>
                  
                  {/* Pulsante Stop */}
                  <button
                    onClick={stopProcessing}
                    className="rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500"
                  >
                    ⏹️ Stop
                  </button>
                </div>
              )}
            </div>
            
            {/* Info durante processing */}
            {processing && (
              <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
                <p className="text-sm text-zinc-400">
                  {isPaused ? (
                    '⏸️ Analisi audio in pausa. Clicca "Riprendi" per continuare.'
                  ) : (
                    <>
                      ⏱️ Analisi audio in corso: 1 traccia ogni 30 secondi per rispettare i limiti del worker.
                      <span className="ml-2 text-purple-400">
                        ({tracks.filter(t => t.status === 'matched' && (t.analysis_status === 'pending' || !t.analysis_status)).length} tracce rimanenti)
                      </span>
                    </>
                  )}
                </p>
              </div>
            )}
            
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
              <div className="max-h-[60vh] overflow-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-zinc-900">
                    <tr className="border-b border-zinc-800">
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Artista</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Titolo</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Stato</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Analisi</th>
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
                        <td className="px-4 py-3">
                          {track.analysis_status === 'analyzed' && (
                            <div className="text-xs space-y-1">
                              {/* BPM e Key — solo se presenti (full track, non preview) */}
                              {track.bpm && (
                                <div className="text-purple-400">
                                  <span>✓ {track.bpm.toFixed(0)} BPM</span>
                                  {track.key && <span className="ml-2">{track.key} {track.scale}</span>}
                                </div>
                              )}
                              {!track.bpm && (
                                <div className="text-purple-400">✓ Analizzata</div>
                              )}
                              {/* Nuove feature stilistiche */}
                              <div className="text-gray-400 flex flex-wrap gap-x-3">
                                {track.onset_strength != null && (
                                  <span title="Aggressività groove">⚡ {(track.onset_strength * 100).toFixed(0)}</span>
                                )}
                                {track.sub_ratio != null && (
                                  <span title="Peso sub">🔊 {(track.sub_ratio * 100).toFixed(0)}%</span>
                                )}
                                {track.mid_presence != null && (
                                  <span title="Mid presence">〰️ {(track.mid_presence * 100).toFixed(0)}%</span>
                                )}
                                {track.tempo_stability != null && (
                                  <span title="Stabilità groove">🎯 {(track.tempo_stability * 100).toFixed(0)}%</span>
                                )}
                                {track.spectral_contrast != null && (
                                  <span title="Contrasto spettrale">🎛️ {(track.spectral_contrast * 100).toFixed(0)}%</span>
                                )}
                              </div>
                            </div>
                          )}
                          {track.analysis_status === 'analyzing' && <span className="text-xs text-yellow-400">🔬 Analizzando...</span>}
                          {(track.analysis_status === 'pending' || !track.analysis_status) && track.status === 'matched' && <span className="text-xs text-zinc-500">⏳ In attesa</span>}
                          {track.analysis_status === 'failed' && <span className="text-xs text-red-400">✗ Errore</span>}
                          {(track.status !== 'matched' || !track.spotify_preview_url) && <span className="text-xs text-zinc-600">-</span>}
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

        {/* Tab Verifica Match Tinder-Style */}
        {activeTab === 'tinder' && (
          <div>
            {verifying ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-zinc-400">Caricamento tracce...</p>
              </div>
            ) : pendingTracks.length === 0 ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <p className="text-zinc-400">Nessuna traccia da verificare!</p>
                <button
                  onClick={() => setActiveTab('tracks')}
                  className="mt-4 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400"
                >
                  Torna alle tracce
                </button>
              </div>
            ) : (
              <div>
                {/* Progresso */}
                <div className="mb-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-zinc-400">Traccia {currentTrackIndex + 1} di {pendingTracks.length}</p>
                      <div className="mt-2 h-2 w-48 rounded-full bg-zinc-800">
                        <div 
                          className="h-2 rounded-full bg-emerald-500 transition-all" 
                          style={{ width: `${((currentTrackIndex + 1) / pendingTracks.length) * 100}%` }} 
                        />
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-emerald-400">✓ {verifiedCount} confermate</p>
                      <p className="text-sm text-red-400">✗ {rejectedCount} rifiutate</p>
                    </div>
                  </div>
                </div>

                {/* Card Traccia Corrente */}
                {(() => {
                  const currentTrack = pendingTracks[currentTrackIndex]
                  if (!currentTrack) return null
                  
                  return (
                    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-6">
                      {/* Titolo Originale */}
                      <div className="mb-6 text-center">
                        <p className="text-sm text-zinc-500">Traccia da verificare:</p>
                        <h3 className="mt-2 text-2xl font-bold text-white">{currentTrack.artist_name}</h3>
                        <p className="text-xl text-zinc-300">{currentTrack.track_title}</p>
                      </div>

                      {/* Match Proposti */}
                      <div className="mb-6">
                        <p className="mb-3 text-center text-sm text-zinc-400">
                          {currentTrack.proposed_matches?.length > 0 
                            ? 'Scegli il match corretto (Deezer = arancione, Spotify = verde):' 
                            : 'Nessun match trovato automaticamente'}
                        </p>
                        
                        <div className="space-y-3">
                          {currentTrack.proposed_matches?.map((match: any, idx: number) => (
                            <div 
                              key={match.id}
                              className={`flex items-center gap-4 rounded-lg border p-4 ${
                                idx === 0 
                                  ? 'border-emerald-500/50 bg-emerald-950/20' 
                                  : 'border-zinc-700 bg-zinc-800/50'
                              } ${!match.preview_url ? 'opacity-60' : ''}`}
                            >
                              {match.image ? (
                                <img src={match.image} alt="" className="h-16 w-16 rounded object-cover" />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded bg-zinc-700 text-2xl">
                                  🎵
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="truncate font-bold text-white">{match.name}</p>
                                  {match.source === 'deezer' && (
                                    <span className="rounded bg-orange-600 px-1.5 py-0.5 text-xs text-white">Deezer</span>
                                  )}
                                  {match.source === 'spotify' && (
                                    <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs text-white">Spotify</span>
                                  )}
                                  {!match.preview_url && (
                                    <span className="rounded bg-red-900/50 px-1.5 py-0.5 text-xs text-red-400">No Preview</span>
                                  )}
                                </div>
                                <p className="truncate text-zinc-400">{match.artist}</p>
                                <p className="truncate text-sm text-zinc-500">{match.album}</p>
                                <div className="mt-1 flex gap-3 text-xs text-zinc-500">
                                  <span>⏱ {match.duration_formatted}</span>
                                  <span>♥ {match.rank || match.popularity}/100</span>
                                  {match.explicit && <span className="text-red-400">🔞 Explicit</span>}
                                </div>
                              </div>
                              
                              <div className="flex flex-col gap-2">
                                <button
                                  onClick={() => confirmCurrentMatch(match)}
                                  className={`rounded px-4 py-2 text-sm font-semibold text-white ${
                                    match.preview_url 
                                      ? 'bg-emerald-600 hover:bg-emerald-500' 
                                      : 'bg-yellow-600 hover:bg-yellow-500'
                                  }`}
                                >
                                  {match.preview_url ? '✓ Questo!' : '✓ Salva (no preview)'}
                                </button>
                                <a
                                  href={match.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="rounded bg-zinc-700 px-4 py-1 text-center text-xs text-zinc-300 hover:bg-zinc-600"
                                >
                                  Apri {match.source === 'deezer' ? 'Deezer' : 'Spotify'}
                                </a>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Azioni */}
                      <div className="flex flex-wrap items-center justify-center gap-3">
                        <button
                          onClick={rejectCurrentMatch}
                          className="rounded-lg bg-red-600 px-6 py-3 font-semibold text-white hover:bg-red-500"
                        >
                          ✗ Nessuno è corretto
                        </button>
                        
                        <button
                          onClick={skipCurrentTrack}
                          className="rounded-lg bg-zinc-700 px-6 py-3 font-semibold text-white hover:bg-zinc-600"
                        >
                          Salta per ora
                        </button>
                        
                        {currentTrackIndex > 0 && (
                          <button
                            onClick={prevTrack}
                            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-500"
                          >
                            ← Precedente
                          </button>
                        )}
                      </div>

                      {/* Cerca Alternativa */}
                      <div className="mt-6 border-t border-zinc-800 pt-4">
                        <p className="mb-2 text-sm text-zinc-500">Cerca un altro match:</p>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            defaultValue={`${currentTrack.artist_name} ${currentTrack.track_title}`}
                            onKeyPress={(e) => {
                              if (e.key === 'Enter') {
                                searchAlternative((e.target as HTMLInputElement).value)
                              }
                            }}
                            className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-white"
                            placeholder="Artista - Titolo"
                          />
                          <button
                            onClick={() => {
                              const input = document.querySelector('input[placeholder="Artista - Titolo"]') as HTMLInputElement
                              searchAlternative(input?.value || '')
                            }}
                            disabled={searching}
                            className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-500 disabled:opacity-50"
                          >
                            {searching ? '...' : 'Cerca'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
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
                <div className="mb-6 flex flex-wrap gap-3">
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
                  
                  {/* Azioni sempre disponibili */}
                  <button
                    onClick={() => resetTrack(modalTrack.id)}
                    className="rounded-lg bg-yellow-600 px-4 py-2 text-white hover:bg-yellow-500"
                    title="Resetta per nuova analisi"
                  >
                    🔄 Rianalizza
                  </button>
                  
                  <button
                    onClick={() => deleteTrack(modalTrack.id)}
                    className="rounded-lg bg-zinc-700 px-4 py-2 text-white hover:bg-red-600"
                    title="Elimina traccia"
                  >
                    🗑️ Elimina
                  </button>
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
