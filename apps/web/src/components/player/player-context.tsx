'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

export interface PlayerTrack {
  id: string
  title: string | null
  artist: string | null
  cover_url: string | null
  file_url: string | null
  bucketLabel?: string | null
}

interface PlayerState {
  current: PlayerTrack | null
  playing: boolean
  progress: number // 0..1
  duration: number
  toggle: (t: PlayerTrack) => void
  pause: () => void
  seek: (frac: number) => void
}

const Ctx = createContext<PlayerState | null>(null)

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [current, setCurrent] = useState<PlayerTrack | null>(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const countedRef = useRef<Set<string>>(new Set())

  const trackPlay = useCallback((id: string) => {
    if (countedRef.current.has(id)) return
    countedRef.current.add(id)
    fetch('/api/catalog/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: id }),
    }).catch(() => {})
  }, [])

  const toggle = useCallback((t: PlayerTrack) => {
    const el = audioRef.current
    if (!el || !t.file_url) return
    if (current?.id === t.id) {
      if (el.paused) { el.play().catch(() => {}) } else { el.pause() }
      return
    }
    setCurrent(t)
    setProgress(0)
    el.src = t.file_url
    el.play().then(() => trackPlay(t.id)).catch(() => {})
  }, [current, trackPlay])

  const pause = useCallback(() => { audioRef.current?.pause() }, [])

  const seek = useCallback((frac: number) => {
    const el = audioRef.current
    if (el && el.duration) el.currentTime = frac * el.duration
  }, [])

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onTime = () => { if (el.duration) setProgress(el.currentTime / el.duration) }
    const onMeta = () => setDuration(el.duration || 0)
    const onEnd = () => { setPlaying(false); setProgress(0) }
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnd)
    return () => {
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnd)
    }
  }, [])

  return (
    <Ctx.Provider value={{ current, playing, progress, duration, toggle, pause, seek }}>
      {children}
      {/* Singolo elemento audio globale: la riproduzione persiste tra le pagine */}
      <audio ref={audioRef} preload="none" />
    </Ctx.Provider>
  )
}

export function usePlayer(): PlayerState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('usePlayer deve essere usato dentro PlayerProvider')
  return ctx
}
