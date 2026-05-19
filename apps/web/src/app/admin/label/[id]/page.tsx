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

export default function LabelDetailPage() {
  const params = useParams()
  const labelId = params.id as string
  
  const [tracks, setTracks] = useState<Track[]>([])
  const [labelName, setLabelName] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('all')

  useEffect(() => {
    if (labelId) {
      fetchTracks()
    }
  }, [labelId, filter])

  const fetchTracks = async () => {
    try {
      let url = `/api/admin/label-tracks?label_id=${labelId}`
      if (filter !== 'all') {
        url += `&status=${filter}`
      }
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (response.ok) {
        setTracks(data.tracks || [])
        setLabelName(data.labelName || '')
      }
    } catch (error) {
      console.error('Error fetching tracks:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'matched':
        return <span className="rounded bg-emerald-900/50 px-2 py-1 text-xs text-emerald-400">✓ Match</span>
      case 'needs_review':
        return <span className="rounded bg-yellow-900/50 px-2 py-1 text-xs text-yellow-400">⚠ Verifica</span>
      case 'failed':
        return <span className="rounded bg-red-900/50 px-2 py-1 text-xs text-red-400">✗ Non trovato</span>
      case 'pending':
        return <span className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-400">⏳ In attesa</span>
      default:
        return <span className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-400">{status}</span>
    }
  }

  if (loading) {
    return <div className="min-h-screen bg-black p-8 text-white">Caricamento...</div>
  }

  return (
    <div className="min-h-screen bg-black p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <a href="/admin/labels" className="text-sm text-zinc-500 hover:text-white">← Torna alle label</a>
            <h1 className="mt-2 text-2xl font-bold text-white">{labelName}</h1>
            <p className="text-zinc-500">{tracks.length} tracce</p>
          </div>
          
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-white"
          >
            <option value="all">Tutte</option>
            <option value="matched">✓ Match trovati</option>
            <option value="needs_review">⚠ Da verificare</option>
            <option value="failed">✗ Non trovati</option>
            <option value="pending">⏳ In attesa</option>
          </select>
        </div>

        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900">
                <tr className="border-b border-zinc-800">
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Artista</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Titolo</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Stato</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Confidence</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-zinc-400">Preview</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {tracks.map((track) => (
                  <tr key={track.id} className="hover:bg-zinc-800/50">
                    <td className="px-4 py-3 text-sm text-white">{track.artist_name || '-'}</td>
                    <td className="px-4 py-3 text-sm text-white">{track.track_title}</td>
                    <td className="px-4 py-3">{getStatusBadge(track.status)}</td>
                    <td className="px-4 py-3 text-sm text-zinc-400">
                      {track.spotify_match_confidence 
                        ? `${(track.spotify_match_confidence * 100).toFixed(0)}%` 
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      {track.spotify_preview_url ? (
                        <span className="text-xs text-emerald-400">✓ Disponibile</span>
                      ) : (
                        <span className="text-xs text-zinc-500">✗ No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
