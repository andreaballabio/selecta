'use client'

import { useState, useEffect } from 'react'

interface Label {
  id: string
  name: string
  slug: string
  source: string
  primary_genre: string
  cataloged_tracks: number
  created_at: string
}

export default function AdminLabelsPage() {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetchLabels()
  }, [])

  const fetchLabels = async () => {
    try {
      const response = await fetch('/api/admin/labels')
      const data = await response.json()
      if (response.ok) {
        setLabels(data.labels || [])
      }
    } catch (error) {
      console.error('Error fetching labels:', error)
    } finally {
      setLoading(false)
    }
  }

  const deleteLabel = async (labelId: string) => {
    if (!confirm('Sei sicuro di voler eliminare questa label? Tutte le tracce associate verranno cancellate.')) {
      return
    }

    try {
      const response = await fetch(`/api/admin/labels?id=${labelId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMessage('✓ Label eliminata')
        setLabels(labels.filter(l => l.id !== labelId))
      } else {
        setMessage('✗ Errore nell\'eliminazione')
      }
    } catch (error) {
      setMessage('✗ Errore di connessione')
    }
  }

  const reprocessLabel = async (labelId: string) => {
    // Resetta lo stato delle tracce a 'pending'
    try {
      const response = await fetch('/api/admin/reset-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label_id: labelId })
      })

      if (response.ok) {
        setMessage('✓ Label resettata. Ora puoi riprocessare.')
        fetchLabels()
      }
    } catch (error) {
      setMessage('✗ Errore nel reset')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-bg p-8 text-text">Caricamento...</div>
  }

  return (
    <div className="min-h-screen bg-bg p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text">Gestione Label</h1>
          <a
            href="/admin/create-label"
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-accent-ink hover:bg-accent"
          >
            + Crea Label
          </a>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
          </div>
        )}

        <div className="grid gap-6">
          {/* Lista Label */}
          <div className="lg:col-span-3">
            <div className="rounded-lg border border-line bg-surface-2/50">
              <div className="border-b border-line p-4">
                <h2 className="font-semibold text-text">Label ({labels.length})</h2>
              </div>
              
              <div className="divide-y divide-line">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    className="flex cursor-pointer items-center justify-between rounded-lg border border-line bg-surface-2/50 p-4 transition-colors hover:border-accent/50"
                  >
                    <a 
                      href={`/admin/label/${label.id}`}
                      className="flex-1"
                    >
                      <h3 className="font-medium text-text">{label.name}</h3>
                      <p className="text-sm text-muted">
                        {label.primary_genre} • {label.cataloged_tracks} tracce
                      </p>
                    </a>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          reprocessLabel(label.id)
                        }}
                        className="rounded bg-surface-2 px-3 py-1 text-xs text-text hover:bg-surface-2"
                      >
                        Riprocessa
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          deleteLabel(label.id)
                        }}
                        className="rounded bg-red-900/50 px-3 py-1 text-xs text-red-400 hover:bg-red-900"
                      >
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
