'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { Play, Pause } from 'lucide-react'
import { usePlayer } from './player-context'

export function PlayerBar() {
  const { current, playing, progress, toggle, seek } = usePlayer()
  const barRef = useRef<HTMLDivElement | null>(null)

  // Lascia spazio in fondo alla pagina quando il player è visibile.
  useEffect(() => {
    document.body.style.paddingBottom = current ? '5.5rem' : ''
    return () => { document.body.style.paddingBottom = '' }
  }, [current])

  if (!current) return null

  const initials = (current.title || '?').trim().slice(0, 2).toUpperCase()

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = barRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    seek(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-800/80 bg-zinc-950/85 backdrop-blur-xl">
      <div
        ref={barRef}
        onClick={onSeek}
        className="group h-1 w-full cursor-pointer bg-zinc-800"
        aria-label="Avanzamento"
      >
        <div className="relative h-full bg-emerald-500" style={{ width: `${progress * 100}%` }}>
          <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-emerald-400 opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-emerald-500/30 to-cyan-500/15">
          {current.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={current.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-sm font-bold text-emerald-300">{initials}</div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <Link href={`/catalog/${current.id}`} className="block truncate text-sm font-semibold text-white hover:text-emerald-400">
            {current.title || 'Senza titolo'}
          </Link>
          <p className="truncate text-xs text-zinc-500">{current.artist || 'Sconosciuto'}</p>
        </div>

        {/* Equalizer animato quando suona */}
        {playing && (
          <div className="hidden items-end gap-0.5 sm:flex" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="eq-bar w-0.5 rounded-full bg-emerald-400" style={{ height: 14, animationDelay: `${i * 0.12}s` }} />
            ))}
          </div>
        )}

        <button
          onClick={() => toggle(current)}
          aria-label={playing ? 'Pausa' : 'Play'}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-black transition-transform hover:scale-105"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
      </div>
    </div>
  )
}
