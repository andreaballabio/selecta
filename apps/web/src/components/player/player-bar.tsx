'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, X } from 'lucide-react'
import { usePlayer } from './player-context'

const fmt = (s: number) => {
  if (!isFinite(s) || s <= 0) return '0:00'
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function PlayerBar() {
  const p = usePlayer()
  const barRef = useRef<HTMLDivElement | null>(null)
  const [queueOpen, setQueueOpen] = useState(false)

  useEffect(() => {
    document.body.style.paddingBottom = p.current ? '5.75rem' : ''
    return () => { document.body.style.paddingBottom = '' }
  }, [p.current])

  if (!p.current) return null
  const c = p.current
  const initials = (c.title || '?').trim().slice(0, 2).toUpperCase()
  const cur = p.duration * p.progress

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = barRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    p.seek(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)))
  }

  return (
    <>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 backdrop-blur-xl">
        <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 sm:grid-cols-[1fr_auto_1fr] sm:px-6">
          {/* sx: traccia */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
              {c.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
              ) : <div className="flex h-full w-full items-center justify-center font-display text-sm font-bold text-faint">{initials}</div>}
            </div>
            <div className="min-w-0">
              <Link href={`/catalog/${c.id}`} className="block truncate text-sm font-semibold text-text hover:text-accent">{c.title || 'Senza titolo'}</Link>
              <p className="truncate text-xs text-muted">{c.artist || 'Sconosciuto'}</p>
            </div>
          </div>

          {/* centro: controlli + progress */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={p.toggleShuffle} aria-label="Casuale" className={`hidden sm:block ${p.shuffle ? 'text-accent' : 'text-muted hover:text-text'}`}>
                <Shuffle className="h-4 w-4" />
              </button>
              <button onClick={p.prev} aria-label="Precedente" className="text-muted hover:text-text"><SkipBack className="h-5 w-5" /></button>
              <button onClick={p.togglePlay} aria-label={p.playing ? 'Pausa' : 'Play'} className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-ink transition-transform hover:scale-105">
                {p.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              </button>
              <button onClick={p.next} aria-label="Successiva" className="text-muted hover:text-text"><SkipForward className="h-5 w-5" /></button>
              <button onClick={p.cycleRepeat} aria-label="Ripeti" className={`hidden sm:block ${p.repeat !== 'off' ? 'text-accent' : 'text-muted hover:text-text'}`}>
                {p.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>
            <div className="hidden w-full max-w-md items-center gap-2 sm:flex">
              <span className="w-9 text-right text-[11px] tabular-nums text-faint">{fmt(cur)}</span>
              <div ref={barRef} onClick={onSeek} className="group h-1 flex-1 cursor-pointer rounded-full bg-line">
                <div className="relative h-full rounded-full bg-accent" style={{ width: `${p.progress * 100}%` }}>
                  <span className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 translate-x-1/2 rounded-full bg-accent opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              </div>
              <span className="w-9 text-[11px] tabular-nums text-faint">{fmt(p.duration)}</span>
            </div>
          </div>

          {/* dx: coda */}
          <div className="hidden items-center justify-end gap-3 sm:flex">
            <button onClick={() => setQueueOpen((v) => !v)} aria-label="Coda" className={queueOpen ? 'text-accent' : 'text-muted hover:text-text'}>
              <ListMusic className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* progress sottile su mobile */}
        <div onClick={onSeek} className="h-0.5 w-full cursor-pointer bg-line sm:hidden">
          <div className="h-full bg-accent" style={{ width: `${p.progress * 100}%` }} />
        </div>
      </div>
    </>
  )
}

function QueuePanel({ onClose }: { onClose: () => void }) {
  const p = usePlayer()
  return (
    <div className="fixed bottom-[5.75rem] right-3 z-50 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-sm font-bold text-text">In coda</p>
        <button onClick={onClose} aria-label="Chiudi" className="text-muted hover:text-text"><X className="h-4 w-4" /></button>
      </div>
      <div className="max-h-[55vh] overflow-y-auto p-2">
        {p.current && (
          <>
            <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wider text-faint">In riproduzione</p>
            <Row track={p.current} active onClick={() => {}} />
          </>
        )}
        {p.upNext.length > 0 ? (
          <>
            <p className="px-2 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-faint">Successive</p>
            {p.upNext.map((t, i) => (
              <Row key={`${t.id}-${i}`} track={t} onClick={() => p.toggle(t)} />
            ))}
          </>
        ) : (
          <p className="px-2 py-4 text-center text-sm text-muted">Niente altro in coda.</p>
        )}
      </div>
    </div>
  )
}

function Row({ track, active, onClick }: { track: { id: string; title: string | null; artist: string | null; cover_url: string | null }; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-surface-2">
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
        {track.cover_url
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-faint">{(track.title || '?').slice(0, 2).toUpperCase()}</div>}
      </div>
      <div className="min-w-0">
        <p className={`truncate text-sm ${active ? 'font-semibold text-accent' : 'text-text'}`}>{track.title || 'Senza titolo'}</p>
        <p className="truncate text-xs text-muted">{track.artist || 'Sconosciuto'}</p>
      </div>
    </button>
  )
}
