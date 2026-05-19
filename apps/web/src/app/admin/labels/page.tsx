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

interface QueueStats {
  pending: number
  matched: number
  needs_review: number
  failed: number
}

export default function AdminLabelsPage() {
  const [labels, setLabels] = useState<Label[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLabel, setSelectedLabel] = useState<Label | null>(null)
  const [stats, setStats] = useState<QueueStats | null>(null)
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

  const fetchLabelStats = async (labelId: string) => {
    try {
      const response = await fetch(`/api/admin/process-ingestion?label_id=${labelId}`)
      const data = await response.json()
      if (response.ok) {
        setStats({
          pending: data.counts?.pending || 0,
          matched: data.counts?.matched || 0,
          needs_review: data.counts?.needs_review || 0,
          failed: data.counts?.failed || 0
        })
      }
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const selectLabel = (label: Label) => {
    setSelectedLabel(label)
    fetchLabelStats(label.id)
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
        setSelectedLabel(null)
        setStats(null)
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
        fetchLabelStats(labelId)
      }
    } catch (error) {
      setMessage('✗ Errore nel reset')
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-white">Caricamento...</div>
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Gestione Label</h1>
          <a
            href="/admin/bulk-add"
            className="rounded-lg bg-emerald-500 px-4 py-2 font-semibold text-black hover:bg-emerald-400"
          >
            + Aggiungi Label
          </a>
        </div>

        {message && (
          <div className={`mb-6 rounded-lg p-4 ${message.startsWith('✓') ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
            {message}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Lista Label */}
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
              <div className="border-b border-zinc-800 p-4">
                <h2 className="font-semibold text-white">Label ({labels.length})</h2>
              </div>
              
              <div className="divide-y divide-zinc-800">
                {labels.map((label) => (
                  <div
                    key={label.id}
                    onClick={() => selectLabel(label)}
                    className={`cursor-pointer p-4 transition-colors hover:bg-zinc-800/50 ${
                      selectedLabel?.id === label.id ? 'bg-zinc-800' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-white">{label.name}</h3>
                        <p className="text-sm text-zinc-500">
                          {label.primary_genre} • {label.cataloged_tracks} tracce • Fonte: {label.source}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            reprocessLabel(label.id)
                          }}
                          className="rounded bg-zinc-700 px-3 py-1 text-xs text-white hover:bg-zinc-600"
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
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Dettagli Label */}
          <div>
            {selectedLabel ? (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
                <h2 className="mb-4 font-semibold text-white">{selectedLabel.name}</h2>
                
                {stats && (
                  <div className="space-y-3">
                    <div className="rounded-lg bg-zinc-800/50 p-3">
                      <p className="text-xs text-zinc-500">In attesa</p>
                      <p className="text-xl font-bold text-white">{stats.pending}</p>
                    </div>
                    
                    <div className="rounded-lg bg-emerald-900/20 p-3">
                      <p className="text-xs text-zinc-500">Match trovati</p>
                      <p className="text-xl font-bold text-emerald-400">{stats.matched}</p>
                    </div>
                    
                    <div className="rounded-lg bg-yellow-900/20 p-3">
                      <p className="text-xs text-zinc-500">Da verificare</p>
                      <p className="text-xl font-bold text-yellow-400">{stats.needs_review}</p>
                    </div>
                    
                    <div className="rounded-lg bg-red-900/20 p-3">
                      <p className="text-xs text-zinc-500">Non trovati</p>
                      <p className="text-xl font-bold text-red-400">{stats.failed}</p>
                    </div>
                    
                    <a
                      href={`/admin/label/${selectedLabel.id}`}
                      className="mt-4 block w-full rounded-lg bg-zinc-700 py-2 text-center text-sm text-white hover:bg-zinc-600"
                    >
                      Vedi dettaglio tracce →
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 text-center">
                <p className="text-zinc-500">Seleziona una label per vedere i dettagli</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
