'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

export interface PlayerTrack {
  id: string
  title: string | null
  artist: string | null
  cover_url: string | null
  file_url: string | null
  bucketLabel?: string | null
}

export type RepeatMode = 'off' | 'all' | 'one'

interface PlayerState {
  current: PlayerTrack | null
  queue: PlayerTrack[]
  order: number[]
  pos: number
  upNext: PlayerTrack[]
  playing: boolean
  progress: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode
  autoplay: boolean
  volume: number
  playQueue: (tracks: PlayerTrack[], startIndex?: number) => void
  toggle: (t: PlayerTrack) => void
  togglePlay: () => void
  next: () => void
  prev: () => void
  toggleShuffle: () => void
  cycleRepeat: () => void
  toggleAutoplay: () => void
  setVolume: (v: number) => void
  seek: (frac: number) => void
  addToQueue: (t: PlayerTrack) => void
  playNext: (t: PlayerTrack) => void
  removeAt: (orderPos: number) => void
  clearUpNext: () => void
  jumpTo: (queueIndex: number) => void
}

const Ctx = createContext<PlayerState | null>(null)
const shuffled = (n: number) => { const a = Array.from({ length: n }, (_, i) => i); for (let i = n - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]] } return a }

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [queue, setQueue] = useState<PlayerTrack[]>([])
  const [order, setOrder] = useState<number[]>([])
  const [pos, setPos] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [shuffle, setShuffle] = useState(false)
  const [repeat, setRepeat] = useState<RepeatMode>('off')
  const [autoplay, setAutoplay] = useState(true)
  const [volume, setVol] = useState(1)
  const counted = useRef<Set<string>>(new Set())

  const qIndex = order[pos] ?? -1
  const current = queue[qIndex] ?? null

  const load = useCallback((track: PlayerTrack | undefined) => {
    const el = audioRef.current
    if (!el || !track?.file_url) return
    el.src = track.file_url
    el.play().then(() => {
      if (!counted.current.has(track.id)) {
        counted.current.add(track.id)
        fetch('/api/catalog/play', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: track.id }) }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  const playQueue = useCallback((tracks: PlayerTrack[], startIndex = 0) => {
    if (tracks.length === 0) return
    const ord = shuffle ? [startIndex, ...shuffled(tracks.length).filter((i) => i !== startIndex)] : Array.from({ length: tracks.length }, (_, i) => i)
    setQueue(tracks); setOrder(ord); setPos(shuffle ? 0 : startIndex); setProgress(0)
    load(tracks[startIndex])
  }, [shuffle, load])

  const togglePlay = useCallback(() => { const el = audioRef.current; if (!el) return; if (el.paused) el.play().catch(() => {}); else el.pause() }, [])

  const toggle = useCallback((t: PlayerTrack) => {
    if (current?.id === t.id) { togglePlay(); return }
    const idx = queue.findIndex((x) => x.id === t.id)
    if (idx >= 0) { setPos(order.indexOf(idx)); load(queue[idx]); return }
    playQueue([t], 0)
  }, [current, queue, order, togglePlay, load, playQueue])

  const next = useCallback(() => {
    if (queue.length === 0) return
    if (repeat === 'one') { const el = audioRef.current; if (el) { el.currentTime = 0; el.play().catch(() => {}) } return }
    if (pos + 1 < order.length) { setPos(pos + 1); load(queue[order[pos + 1]]) }
    else if (repeat === 'all') { setPos(0); load(queue[order[0]]) }
    else { const el = audioRef.current; if (el) el.pause() }
  }, [queue, order, pos, repeat, load])

  const prev = useCallback(() => {
    const el = audioRef.current
    if (el && el.currentTime > 3) { el.currentTime = 0; return }
    if (pos - 1 >= 0) { setPos(pos - 1); load(queue[order[pos - 1]]) }
    else if (el) el.currentTime = 0
  }, [queue, order, pos, load])

  const toggleShuffle = useCallback(() => {
    setShuffle((s) => {
      const ns = !s
      setOrder((prevOrder) => {
        if (prevOrder.length === 0) return prevOrder
        const cur = prevOrder[pos]
        if (ns) { setPos(0); return [cur, ...shuffled(queue.length).filter((i) => i !== cur)] }
        setPos(cur); return Array.from({ length: queue.length }, (_, i) => i)
      })
      return ns
    })
  }, [pos, queue.length])

  const cycleRepeat = useCallback(() => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off')), [])
  const toggleAutoplay = useCallback(() => setAutoplay((a) => !a), [])
  const setVolume = useCallback((v: number) => { setVol(v); const el = audioRef.current; if (el) el.volume = v }, [])
  const seek = useCallback((frac: number) => { const el = audioRef.current; if (el && el.duration) el.currentTime = frac * el.duration }, [])

  const addToQueue = useCallback((t: PlayerTrack) => setQueue((q) => { const ni = q.length; setOrder((o) => [...o, ni]); return [...q, t] }), [])
  const playNext = useCallback((t: PlayerTrack) => {
    setQueue((q) => { const ni = q.length; setOrder((o) => { const no = [...o]; no.splice(pos + 1, 0, ni); return no }); return [...q, t] })
  }, [pos])
  const removeAt = useCallback((orderPos: number) => { if (orderPos > pos) setOrder((o) => o.filter((_, i) => i !== orderPos)) }, [pos])
  const clearUpNext = useCallback(() => setOrder((o) => o.slice(0, pos + 1)), [pos])
  const jumpTo = useCallback((queueIndex: number) => { const p = order.indexOf(queueIndex); if (p >= 0) { setPos(p); load(queue[queueIndex]) } }, [order, queue, load])

  // snapshot per il gestore 'ended' (evita closure stantie + abilita autoplay)
  const stateRef = useRef({ queue, order, pos, repeat, autoplay, current })
  stateRef.current = { queue, order, pos, repeat, autoplay, current }

  const handleEnded = useCallback(async () => {
    setProgress(0)
    const s = stateRef.current
    if (s.repeat === 'one') { const el = audioRef.current; if (el) { el.currentTime = 0; el.play().catch(() => {}) } return }
    if (s.pos + 1 < s.order.length) { setPos(s.pos + 1); load(s.queue[s.order[s.pos + 1]]); return }
    if (s.repeat === 'all' && s.queue.length) { setPos(0); load(s.queue[s.order[0]]); return }
    if (s.autoplay && s.current) {
      try {
        const exclude = s.queue.map((t) => t.id).join(',')
        const res = await fetch(`/api/catalog/autoplay?id=${s.current.id}&exclude=${exclude}`)
        const data = await res.json()
        const tracks: PlayerTrack[] = data.tracks ?? []
        if (tracks.length) {
          const base = s.queue.length
          setQueue([...s.queue, ...tracks])
          setOrder([...s.order, ...tracks.map((_, i) => base + i)])
          setPos(s.order.length)
          load(tracks[0])
          return
        }
      } catch { /* fine */ }
    }
  }, [load])

  const endedRef = useRef(handleEnded); endedRef.current = handleEnded
  useEffect(() => {
    const el = audioRef.current; if (!el) return
    el.volume = volume
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => { if (el.duration) setProgress(el.currentTime / el.duration) }
    const onMeta = () => setDuration(el.duration || 0)
    const onEnd = () => endedRef.current()
    el.addEventListener('play', onPlay); el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime); el.addEventListener('loadedmetadata', onMeta); el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('play', onPlay); el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime); el.removeEventListener('loadedmetadata', onMeta); el.removeEventListener('ended', onEnd)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const upNext = useMemo(() => order.slice(pos + 1).map((i) => queue[i]).filter(Boolean), [order, pos, queue])

  const value: PlayerState = {
    current, queue, order, pos, upNext, playing, progress, duration, shuffle, repeat, autoplay, volume,
    playQueue, toggle, togglePlay, next, prev, toggleShuffle, cycleRepeat, toggleAutoplay, setVolume, seek,
    addToQueue, playNext, removeAt, clearUpNext, jumpTo,
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="none" />
    </Ctx.Provider>
  )
}

export function usePlayer(): PlayerState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayer deve essere usato dentro PlayerProvider')
  return ctx
}
