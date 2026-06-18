'use client'

import { useEffect, useRef, useState } from 'react'
import { usePlayer, type PlayerTrack } from './player-context'

const N = 160
const cache = new Map<string, { peaks: number[]; dur: number }>()

function pseudoPeaks(seed: string): number[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const out: number[] = []
  for (let i = 0; i < N; i++) {
    h = (h * 1103515245 + 12345) >>> 0
    const base = 0.35 + (h % 1000) / 1000 * 0.6
    const env = 0.6 + 0.4 * Math.sin((i / N) * Math.PI)
    out.push(Math.min(1, base * env))
  }
  return out
}

export interface WaveComment { pos: number; body: string; author: string | null }

export function Waveform({ track, comments = [] }: { track: PlayerTrack; comments?: WaveComment[] }) {
  const player = usePlayer()
  const [peaks, setPeaks] = useState<number[] | null>(null)
  const [dur, setDur] = useState(0)
  const rowRef = useRef<HTMLDivElement | null>(null)
  const isCurrent = player.current?.id === track.id
  const progress = isCurrent ? player.progress : 0
  const duration = isCurrent && player.duration ? player.duration : dur

  useEffect(() => {
    let cancelled = false
    const url = track.file_url
    if (!url) { setPeaks(pseudoPeaks(track.id)); return }
    const cached = cache.get(url)
    if (cached) { setPeaks(cached.peaks); setDur(cached.dur); return }
    ;(async () => {
      try {
        const res = await fetch(url)
        const buf = await res.arrayBuffer()
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const ac = new AC()
        const audio = await ac.decodeAudioData(buf)
        const ch = audio.getChannelData(0)
        const block = Math.max(1, Math.floor(ch.length / N))
        const out: number[] = []
        for (let i = 0; i < N; i++) { let max = 0; for (let j = 0; j < block; j++) { const v = Math.abs(ch[i * block + j] || 0); if (v > max) max = v } out.push(max) }
        const norm = Math.max(...out) || 1
        const peaks = out.map((v) => Math.max(0.06, v / norm))
        const d = audio.duration
        ac.close()
        if (!cancelled) { cache.set(url, { peaks, dur: d }); setPeaks(peaks); setDur(d) }
      } catch { if (!cancelled) setPeaks(pseudoPeaks(track.id)) }
    })()
    return () => { cancelled = true }
  }, [track.file_url, track.id])

  const data = peaks ?? pseudoPeaks(track.id)

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = rowRef.current; if (!el) return
    const frac = Math.min(1, Math.max(0, (e.clientX - el.getBoundingClientRect().left) / el.clientWidth))
    if (isCurrent) player.seek(frac)
    else player.playQueue([track], 0)
  }

  return (
    <div className="relative">
      {/* marker commenti */}
      {duration > 0 && comments.length > 0 && (
        <div className="pointer-events-none absolute inset-x-0 -top-1 z-10 h-3">
          {comments.map((c, i) => (
            <span
              key={i}
              title={`${c.author ? c.author + ': ' : ''}${c.body}`}
              className="pointer-events-auto absolute -translate-x-1/2 cursor-help"
              style={{ left: `${Math.min(100, (c.pos / duration) * 100)}%` }}
            >
              <span className="block h-2.5 w-2.5 rounded-full border border-bg bg-accent" />
            </span>
          ))}
        </div>
      )}

      <div ref={rowRef} onClick={onClick} className="flex h-16 w-full cursor-pointer items-center gap-[2px]" aria-label="Waveform">
        {data.map((v, i) => {
          const played = i / N <= progress
          return <span key={i} className={`w-full rounded-sm ${played ? 'bg-accent' : 'bg-line'} ${peaks ? '' : 'opacity-60'}`} style={{ height: `${Math.max(8, v * 100)}%` }} />
        })}
      </div>
    </div>
  )
}
