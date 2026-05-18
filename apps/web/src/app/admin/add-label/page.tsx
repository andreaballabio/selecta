'use client'

import { useState, useEffect } from 'react'

interface SpotifySearchResult {
  name: string
  tracks_found: number
  tracks_with_preview: number
  sample_tracks: Array<{
    name: string
    artist: string
    album: string
    has_preview: boolean
  }>
}

export default function AddLabelPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    genre: 'tech house'
  })
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [message, setMessage] = useState('')
  const [searchResult, setSearchResult] = useState<SpotifySearchResult | null>(null)
  const [searchError, setSearchError] = useState('')

  // Debounce search
  useEffect(() => {
    if (!formData.name || formData.name.length < 3) {
      setSearchResult(null)
      return
    }

    const timer = setTimeout(() => {
      searchSpotify(formData.name)
    }, 500)

    return () => clearTimeout(timer)
  }, [formData.name])

  const searchSpotify = async (query: string) => {
    if (query.length < 3) return
    
    setSearching(true)
    setSearchError('')
    
    try {
      const response = await fetch(`/api/admin/search-label?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (response.ok) {
        setSearchResult(data)
      } else {
        setSearchError(data.error || 'Errore nella ricerca')
        setSearchResult(null)
      }
    } catch (error) {
      setSearchError('Errore di connessione')
      setSearchResult(null)
    } finally {
      setSearching(false)
    }
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
        setFormData({ name: '', slug: '', genre: 'tech house' })
        setSearchResult(null)
      } else {
        setMessage(`✗ Errore: ${data.error}`)
      }
    } catch (error) {
      setMessage('✗ Errore di connessione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-lg">
        <h1 className="mb-8 text-2xl font-bold text-white">Aggiungi Label</h1>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
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
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="es. Drumcode"
              required
            />
            
            {/* Search Results */}
            {searching && (
              <p className="mt-2 text-sm text-zinc-500">Ricerca su Spotify...</p>
            )}
            
            {searchError && (
              <p className="mt-2 text-sm text-red-400">{searchError}</p>
            )}
            
            {searchResult && (
              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-900/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="font-semibold text-white">Risultati Spotify</h3>
                  <span className={`text-sm ${searchResult.tracks_with_preview > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {searchResult.tracks_with_preview} preview disponibili
                  </span>
                </div>
                
                <p className="mb-3 text-sm text-zinc-400">
                  Trovate {searchResult.tracks_found} tracce recenti
                </p>
                
                {searchResult.sample_tracks.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-zinc-500">Esempi:</p>
                    {searchResult.sample_tracks.slice(0, 3).map((track, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className={track.has_preview ? 'text-green-400' : 'text-red-400'}>
                          {track.has_preview ? '✓' : '✗'}
                        </span>
                        <span className="truncate text-zinc-300">
                          {track.artist} - {track.name}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                
                {searchResult.tracks_with_preview === 0 && (
                  <p className="mt-2 text-sm text-red-400">
                    ⚠️ Nessuna preview disponibile. Prova un'altra label.
                  </p>
                )}
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
            <p className="mt-1 text-xs text-zinc-600">Usato nell'URL, solo lettere minuscole e trattini</p>
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

          <button
            type="submit"
            disabled={loading || !searchResult || searchResult.tracks_with_preview === 0}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiungendo...' : 'Aggiungi Label'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Cosa succede:</h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>1. Cerco le ultime 50 tracce su Spotify</li>
            <li>2. Mostro anteprima risultati</li>
            <li>3. Confermi e aggiungo al database</li>
            <li>4. Programmo recupero storico (5 anni)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
