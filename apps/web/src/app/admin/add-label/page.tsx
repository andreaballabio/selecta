'use client'

import { useState, useEffect } from 'react'

interface DiscogsResult {
  id: number
  name: string
  url: string
  thumbnail: string
  releases: number
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

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-2xl">
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
                      <p className="text-sm text-zinc-500">{result.releases} releases</p>
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
                  <p className="text-sm text-zinc-400">Da Discogs • {selectedDiscogs.releases} releases</p>
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
            {loading ? 'Aggiungendo...' : selectedDiscogs ? `Aggiungi con ${selectedDiscogs.releases} releases` : 'Aggiungi Label'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Come funziona:</h2>
          <ol className="space-y-1 text-sm text-zinc-400 list-decimal list-inside">
            <li>Scrivi il nome della label</li>
            <li>Seleziona da Discogs (se trovata)</li>
            <li>Il sistema scarica automaticamente le releases</li>
            <li>Cerca il match su Spotify per ogni traccia</li>
            <li>Analizza l&apos;audio e costruisce il profilo label</li>
          </ol>
        </div>
      </div>
    </div>
  )
}
