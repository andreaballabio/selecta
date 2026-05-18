'use client'

import { useState, useEffect } from 'react'

interface VerificationResult {
  found: boolean
  track_count: number
  sample_tracks: Array<{
    name: string
    artist: string
    album: string
  }>
}

export default function AddLabelPage() {
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    genre: 'tech house'
  })
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [message, setMessage] = useState('')
  const [verification, setVerification] = useState<VerificationResult | null>(null)
  const [verifyError, setVerifyError] = useState('')

  // Debounce verification
  useEffect(() => {
    if (!formData.name || formData.name.length < 3) {
      setVerification(null)
      return
    }

    const timer = setTimeout(() => {
      verifyLabel(formData.name)
    }, 600)

    return () => clearTimeout(timer)
  }, [formData.name])

  const verifyLabel = async (name: string) => {
    if (name.length < 3) return
    
    setVerifying(true)
    setVerifyError('')
    setVerification(null)
    
    try {
      const response = await fetch(`/api/admin/verify-label?q=${encodeURIComponent(name)}`)
      const data = await response.json()
      
      if (response.ok) {
        setVerification(data)
      } else {
        setVerifyError(data.error || 'Errore nella verifica')
      }
    } catch (error) {
      setVerifyError('Errore di connessione')
    } finally {
      setVerifying(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!verification?.found) return
    
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
        setVerification(null)
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
              placeholder="es. Drumcode, Solid Grooves, Defected..."
              required
            />
            
            {verifying && (
              <p className="mt-2 text-sm text-zinc-500">Verifica su Spotify...</p>
            )}
            
            {verifyError && (
              <p className="mt-2 text-sm text-red-400">{verifyError}</p>
            )}
            
            {/* Verification Result */}
            {verification && (
              <div className={`mt-3 rounded-lg border p-4 ${
                verification.found 
                  ? 'border-emerald-500/30 bg-emerald-900/20' 
                  : 'border-red-500/30 bg-red-900/20'
              }`}>
                <div className="flex items-center gap-2">
                  <span className={verification.found ? 'text-emerald-400' : 'text-red-400'}>
                    {verification.found ? '✓' : '✗'}
                  </span>
                  <span className="font-medium text-white">
                    {verification.found 
                      ? `Trovate ${verification.track_count} tracce` 
                      : 'Nessuna traccia trovata'}
                  </span>
                </div>
                
                {verification.found && verification.sample_tracks.length > 0 && (
                  <div className="mt-3 space-y-1">
                    <p className="text-xs text-zinc-500">Tracce di esempio:</p>
                    {verification.sample_tracks.slice(0, 3).map((track, i) => (
                      <div key={i} className="text-sm text-zinc-400 truncate">
                        • {track.artist} - {track.name}
                      </div>
                    ))}
                  </div>
                )}
                
                {!verification.found && (
                  <p className="mt-2 text-sm text-zinc-500">
                    Prova con un altro nome o verifica l'ortografia.
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
            disabled={loading || !verification?.found}
            className="w-full rounded-lg bg-emerald-500 px-4 py-3 font-semibold text-black transition-colors hover:bg-emerald-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Aggiungendo...' : 'Aggiungi Label'}
          </button>
        </form>

        <div className="mt-8 rounded-lg border border-zinc-800 bg-zinc-950/50 p-4">
          <h2 className="mb-2 text-sm font-semibold text-white">Come funziona:</h2>
          <ul className="space-y-1 text-sm text-zinc-400">
            <li>1. Inserisci il nome della label</li>
            <li>2. Verifico se esistono tracce su Spotify</li>
            <li>3. Confermi e aggiungo al database</li>
            <li>4. Avvio recupero storico (5 anni)</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
