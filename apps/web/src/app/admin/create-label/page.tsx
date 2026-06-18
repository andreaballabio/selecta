'use client'

import { useState } from 'react'

export default function CreateLabelPage() {
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [genre, setGenre] = useState('tech house')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  // Auto-genera slug
  const handleNameChange = (value: string) => {
    setName(value)
    setSlug(value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const response = await fetch('/api/admin/create-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, genre })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('✓ Label creata!')
        // Redirect dopo 1 secondo
        setTimeout(() => {
          window.location.href = `/admin/label/${data.label.id}`
        }, 1000)
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
    <div className="min-h-screen bg-bg p-8">
      <div className="mx-auto max-w-lg">
        <div className="mb-8">
          <a href="/admin/labels" className="text-sm text-muted hover:text-text">← Torna alle label</a>
          <h1 className="mt-2 text-2xl font-bold text-text">Crea Nuova Label</h1>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="mb-2 block text-sm text-muted">Nome Label *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-text placeholder-faint focus:border-accent focus:outline-none"
              placeholder="es. Drumcode"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted">Slug (URL) *</label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-text placeholder-faint focus:border-accent focus:outline-none"
              placeholder="drumcode"
              required
            />
            <p className="mt-1 text-xs text-faint">Usato nell'URL: /label/drumcode</p>
          </div>

          <div>
            <label className="mb-2 block text-sm text-muted">Genere Principale</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full rounded-lg border border-line bg-surface px-4 py-3 text-text focus:border-accent focus:outline-none"
            >
              <option value="tech house">Tech House</option>
              <option value="techno">Techno</option>
              <option value="house">House</option>
              <option value="deep house">Deep House</option>
              <option value="minimal">Minimal</option>
              <option value="progressive">Progressive</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !name || !slug}
            className="w-full rounded-lg bg-accent px-4 py-3 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:opacity-50"
          >
            {loading ? 'Creando...' : 'Crea Label'}
          </button>
        </form>
      </div>
    </div>
  )
}
