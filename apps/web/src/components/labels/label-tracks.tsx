'use client'

import { useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'

interface T { track_title: string; artist_name: string | null; release_date: string | null; audio_preview_url: string | null }

export function LabelTracks({ tracks }: { tracks: T[] }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<number | null>(null)

  const toggle = (i: number, url: string | null) => {
    if (!url) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playing === i) { a.pause(); setPlaying(null); return }
    a.src = url
    a.play().catch(() => {})
    a.onended = () => setPlaying(null)
    setPlaying(i)
  }

  if (tracks.length === 0) return <p className="text-sm text-muted">Nessuna traccia analizzata ancora.</p>

  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
      {tracks.map((t, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface/50">
          <button onClick={() => toggle(i, t.audio_preview_url)} disabled={!t.audio_preview_url}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text transition-colors hover:bg-accent hover:text-accent-ink disabled:opacity-40"
            aria-label={playing === i ? 'Pausa' : 'Ascolta anteprima'}>
            {playing === i ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{t.track_title}</p>
            <p className="truncate text-xs text-muted">{t.artist_name || '—'}</p>
          </div>
          <span className="shrink-0 text-xs text-faint">{(t.release_date || '').slice(0, 4)}</span>
        </div>
      ))}
    </div>
  )
}
