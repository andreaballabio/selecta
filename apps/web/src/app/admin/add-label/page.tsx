'use client'

import { useState, useEffect } from 'react'

interface LabelResult {
  name: string
  image: string | null
  album_count: number
  sample_artists: string[]
  sample_albums: string[]
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
  const [labels, setLabels] = useState<LabelResult[]>([])
  const [searchError, setSearchError] = useState('')
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)

  // Debounce search
  useEffect(() => {
    if (!formData.name || formData.name.length < 2) {
      setLabels([])
      setSelectedLabel(null)
      return
    }

    const timer = setTimeout(() => {
      searchLabels(formData.name)
    }, 400)

    return () => clearTimeout(timer)
  }, [formData.name])

  const searchLabels = async (query: string) => {
    if (query.length < 2) return
    
    setSearching(true)
    setSearchError('')
    setLabels([])
    setSelectedLabel(null)
    
    try {
      const response = await fetch(`/api/admin/search-label?q=${encodeURIComponent(query)}`)
      const data = await response.json()
      
      if (response.ok) {
        setLabels(data.labels || [])
      } else {
        setSearchError(data.error || 'Errore nella ricerca')
      }
    } catch (error) {
      setSearchError('Errore di connessione')
    } finally {
      setSearching(false)
    }
  }

  const selectLabel = (labelName: string) => {
    setSelectedLabel(labelName)
    setFormData(prev => ({
      ...prev,
      name: labelName,
      slug: labelName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLabel) return
    
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
        setLabels([])
        setSelectedLabel(null)
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
            <label className="mb-2 block text-sm text-zinc-400">Cerca Label</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => {
                const name = e.target.value
                setFormData({ ...formData, name })
                if (!name) {
                  setSelectedLabel(null)
                  setLabels([])
                }
              }}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
              placeholder="es. Drumcode, Solid Grooves, Defected..."
              required
            />
            
            {searching && (
              <p className="mt-2 text-sm text-zinc-500">Ricerca su Spotify...</p>
            )}
            
            {searchError && (
              <p className="mt-2 text-sm text-red-400">{searchError}</p>
            )}
          </div>

          {/* Label Results */}
          {labels.length > 0 && (
            <div className="space-y-3">
              <p className="text-sm text-zinc-500">Seleziona la label corretta:</p>
              {labels.map((label) => (
                <div
                  key={label.name}
                  onClick={() => selectLabel(label.name)}
                  className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                    selectedLabel === label.name
                      ? 'border-emerald-500 bg-emerald-900/20'
                      : 'border-zinc-800 bg-zinc-900/50 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className="h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-zinc-800">
                      {label.image ? (
                        <img
                          src={label.image}
                          alt={label.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl text-zinc-600">
                          ♪
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-white truncate">{label.name}</h3>
                      <p className="text-sm text-zinc-500">
                        {label.album_count} album • {label.sample_artists.slice(0, 3).join(', ')}
                      </p>
                      
                      {label.sample_albums.length > 0 && (
                        <p className="mt-1 text-xs text-zinc-600 truncate">
                          Es: {label.sample_albums.join(', ')}
                        </p>
                      )}
                    </div>
                    
                    {selectedLabel === label.name && (
                      <span className="text-emerald-400 text-xl">✓</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {labels.length === 0 && !searching && formData.name.length >= 2 && (
            <p className="text-sm text-zinc-500">Nessuna label trovata. Prova un altro termine.</p>
          )}

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
            disabled={loading || !selectedLabel}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiungendo...' : 'Aggiungi Label'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Cosa succede:</h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>1. Cerco le label su Spotify</li>
            <li>2. Selezioni la label corretta</li>
            <li>3. Aggiungo al database</li>
            <li>4. Avvio recupero storico (5 anni)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
