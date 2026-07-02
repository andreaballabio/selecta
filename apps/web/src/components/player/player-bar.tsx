'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1, ListMusic, X, Volume2, VolumeX, Radio } from 'lucide-react'
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
  const lastVol = useRef(1)

  useEffect(() => {
    document.body.style.paddingBottom = p.current ? '6.5rem' : ''
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
  const toggleMute = () => { if (p.volume > 0) { lastVol.current = p.volume; p.setVolume(0) } else p.setVolume(lastVol.current || 1) }

  return (
    <>
      {queueOpen && <QueuePanel onClose={() => setQueueOpen(false)} />}

      <div className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-4 sm:pb-4">
        <div className="glass mx-auto grid max-w-5xl grid-cols-[1fr_auto] items-center gap-3 overflow-hidden rounded-[20px] px-3 py-2.5 shadow-xl sm:grid-cols-[1fr_auto_1fr] sm:px-4">
          {/* sx: cover + titolo */}
          <div className="flex min-w-0 items-center gap-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-line">
              {c.cover_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.cover_url} alt="" className="h-full w-full object-cover" />
              ) : <div className="flex h-full w-full items-center justify-center font-display text-sm font-bold text-faint">{initials}</div>}
            </div>
            <div className="min-w-0">
              <Link href={`/catalog/${c.id}`} className="block truncate text-sm font-semibold text-text hover:opacity-70">{c.title || 'Senza titolo'}</Link>
              <p className="truncate text-xs text-muted">{c.artist || 'Sconosciuto'}</p>
            </div>
          </div>

          {/* centro: controlli + progress */}
          <div className="flex flex-col items-center gap-1.5">
            <div className="flex items-center gap-2 sm:gap-4">
              <button onClick={p.toggleShuffle} aria-label="Casuale" className={`hidden sm:block ${p.shuffle ? 'text-text' : 'text-muted hover:text-text'}`}><Shuffle className="h-4 w-4" /></button>
              <button onClick={p.prev} aria-label="Precedente" className="text-muted hover:text-text"><SkipBack className="h-5 w-5" /></button>
              <button onClick={p.togglePlay} aria-label={p.playing ? 'Pausa' : 'Play'} className="flex h-10 w-10 items-center justify-center rounded-full bg-text text-bg shadow-lg transition-transform hover:scale-105">
                {p.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              </button>
              <button onClick={p.next} aria-label="Successiva" className="text-muted hover:text-text"><SkipForward className="h-5 w-5" /></button>
              <button onClick={p.cycleRepeat} aria-label="Ripeti" className={`hidden sm:block ${p.repeat !== 'off' ? 'text-text' : 'text-muted hover:text-text'}`}>
                {p.repeat === 'one' ? <Repeat1 className="h-4 w-4" /> : <Repeat className="h-4 w-4" />}
              </button>
            </div>
            <div className="hidden w-full max-w-md items-center gap-2 sm:flex">
              <span className="w-9 text-right text-[11px] tabular-nums text-faint">{fmt(cur)}</span>
              <div ref={barRef} onClick={onSeek} className="group h-1.5 flex-1 cursor-pointer rounded-full bg-text/10">
                <div className="relative h-full rounded-full bg-text" style={{ width: `${p.progress * 100}%` }}>
                  <span className="absolute right-0 top-1/2 h-3 w-3 -translate-y-1/2 translate-x-1/2 rounded-full bg-text opacity-0 shadow transition-opacity group-hover:opacity-100" />
                </div>
              </div>
              <span className="w-9 text-[11px] tabular-nums text-faint">{fmt(p.duration)}</span>
            </div>
          </div>

          {/* dx: autoplay, volume, coda */}
          <div className="hidden items-center justify-end gap-3 sm:flex">
            <button onClick={p.toggleAutoplay} aria-label="Autoplay" title="Autoplay: continua con tracce simili" className={p.autoplay ? 'text-text' : 'text-muted hover:text-text'}><Radio className="h-[18px] w-[18px]" /></button>
            <div className="flex items-center gap-1.5">
              <button onClick={toggleMute} aria-label="Volume" className="text-muted hover:text-text">{p.volume === 0 ? <VolumeX className="h-[18px] w-[18px]" /> : <Volume2 className="h-[18px] w-[18px]" />}</button>
              <input type="range" min={0} max={1} step={0.02} value={p.volume} onChange={(e) => p.setVolume(Number(e.target.value))} className="h-1 w-20 accent-[var(--accent)]" aria-label="Volume" />
            </div>
            <button onClick={() => setQueueOpen((v) => !v)} aria-label="Coda" className={queueOpen ? 'text-text' : 'text-muted hover:text-text'}><ListMusic className="h-5 w-5" /></button>
          </div>
        </div>

        {/* progress mobile */}
        <div onClick={onSeek} className="mx-auto mt-1 h-1 max-w-5xl cursor-pointer overflow-hidden rounded-full bg-text/10 sm:hidden">
          <div className="h-full rounded-full bg-text" style={{ width: `${p.progress * 100}%` }} />
        </div>
      </div>
    </>
  )
}

function QueuePanel({ onClose }: { onClose: () => void }) {
  const p = usePlayer()
  return (
    <div className="glass fixed bottom-[6.5rem] right-3 z-50 w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl shadow-2xl sm:right-4">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="font-display text-sm font-bold text-text">In coda</p>
        <div className="flex items-center gap-3">
          <button onClick={p.toggleAutoplay} className={`flex items-center gap-1 text-xs ${p.autoplay ? 'text-text' : 'text-muted hover:text-text'}`}><Radio className="h-3.5 w-3.5" /> Autoplay</button>
          {p.upNext.length > 0 && <button onClick={p.clearUpNext} className="text-xs text-muted hover:text-text">Svuota</button>}
          <button onClick={onClose} aria-label="Chiudi" className="text-muted hover:text-text"><X className="h-4 w-4" /></button>
        </div>
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
              <Row key={`${t.id}-${i}`} track={t} onClick={() => p.toggle(t)} onRemove={() => p.removeAt(p.pos + 1 + i)} />
            ))}
          </>
        ) : (
          <p className="px-2 py-4 text-center text-sm text-muted">{p.autoplay ? 'A fine coda parte l’autoplay con tracce simili.' : 'Niente altro in coda.'}</p>
        )}
      </div>
    </div>
  )
}

function Row({ track, active, onClick, onRemove }: { track: { id: string; title: string | null; artist: string | null; cover_url: string | null }; active?: boolean; onClick: () => void; onRemove?: () => void }) {
  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2">
      <button onClick={onClick} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">
          {track.cover_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-faint">{(track.title || '?').slice(0, 2).toUpperCase()}</div>}
        </div>
        <div className="min-w-0">
          <p className={`truncate text-sm ${active ? 'font-semibold text-text' : 'text-text'}`}>{track.title || 'Senza titolo'}</p>
          <p className="truncate text-xs text-muted">{track.artist || 'Sconosciuto'}</p>
        </div>
      </button>
      {onRemove && <button onClick={onRemove} aria-label="Rimuovi" className="shrink-0 text-faint opacity-0 transition-opacity hover:text-text group-hover:opacity-100"><X className="h-4 w-4" /></button>}
    </div>
  )
}
