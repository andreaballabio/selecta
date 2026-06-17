'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, Heart, Bookmark, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { bucketByKey } from '@/lib/sound-bucket'

export interface CatalogTrack {
  id: string
  display_title: string | null
  display_artist: string | null
  cover_url: string | null
  file_url: string | null
  bpm: number | null
  key: string | null
  scale: string | null
  genre: string | null
  sound_bucket: string | null
  likes_count: number | null
  saves_count?: number | null
  play_count?: number | null
}

export function CatalogGrid({ tracks }: { tracks: CatalogTrack[] }) {
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [likes, setLikes] = useState<Record<string, number>>(() => Object.fromEntries(tracks.map((t) => [t.id, t.likes_count ?? 0])))
  const [saves, setSaves] = useState<Record<string, number>>(() => Object.fromEntries(tracks.map((t) => [t.id, t.saves_count ?? 0])))
  const [authed, setAuthed] = useState(false)
  const played = useRef<Set<string>>(new Set())

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setAuthed(true)
      const [{ data: l }, { data: s }] = await Promise.all([
        (supabase as any).from('track_likes').select('submission_id').eq('user_id', user.id),
        (supabase as any).from('track_saves').select('submission_id').eq('user_id', user.id),
      ])
      if (l) setLikedIds(new Set(l.map((r: { submission_id: string }) => r.submission_id)))
      if (s) setSavedIds(new Set(s.map((r: { submission_id: string }) => r.submission_id)))
    })()
  }, [])

  const requireAuth = () => { if (!authed) { window.location.href = '/auth/login'; return false } return true }

  const toggle = async (
    id: string, kind: 'like' | 'save',
    ids: Set<string>, setIds: (f: (p: Set<string>) => Set<string>) => void,
    counts: Record<string, number>, setCounts: (f: (p: Record<string, number>) => Record<string, number>) => void,
  ) => {
    if (!requireAuth()) return
    const was = ids.has(id)
    setIds((prev) => { const n = new Set(prev); was ? n.delete(id) : n.add(id); return n })
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (was ? -1 : 1)) }))
    try {
      const res = await fetch(`/api/catalog/${kind}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: id }),
      })
      const data = await res.json()
      const c = kind === 'like' ? data.likes_count : data.saves_count
      if (typeof c === 'number') setCounts((prev) => ({ ...prev, [id]: c }))
    } catch { /* il prossimo refresh riallinea */ }
  }

  const trackPlay = (id: string) => {
    if (played.current.has(id)) return
    played.current.add(id)
    fetch('/api/catalog/play', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submission_id: id }),
    }).catch(() => {})
  }

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
        <Music className="mx-auto mb-3 h-6 w-6 text-zinc-700" />
        Ancora nessuna traccia qui. Analizza la tua e pubblicala nel catalogo.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {tracks.map((t) => (
        <TrackCard
          key={t.id}
          track={t}
          playing={playingId === t.id}
          liked={likedIds.has(t.id)}
          saved={savedIds.has(t.id)}
          likes={likes[t.id] ?? 0}
          saves={saves[t.id] ?? 0}
          onPlayToggle={() => {
            setPlayingId((cur) => {
              const next = cur === t.id ? null : t.id
              if (next) trackPlay(t.id)
              return next
            })
          }}
          onLike={() => toggle(t.id, 'like', likedIds, setLikedIds, likes, setLikes)}
          onSave={() => toggle(t.id, 'save', savedIds, setSavedIds, saves, setSaves)}
          onEnded={() => setPlayingId(null)}
        />
      ))}
    </div>
  )
}

function TrackCard({
  track, playing, liked, saved, likes, saves, onPlayToggle, onLike, onSave, onEnded,
}: {
  track: CatalogTrack
  playing: boolean; liked: boolean; saved: boolean; likes: number; saves: number
  onPlayToggle: () => void; onLike: () => void; onSave: () => void; onEnded: () => void
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bucket = bucketByKey(track.sound_bucket)
  const initials = (track.display_title || '?').trim().slice(0, 2).toUpperCase()

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    if (playing) el.play().catch(() => {})
    else el.pause()
  }, [playing])

  return (
    <div className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-3 transition-colors hover:border-zinc-700">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10">
        {track.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.cover_url} alt={track.display_title ?? ''} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-emerald-300/70">{initials}</div>
        )}
        <button
          onClick={onPlayToggle}
          aria-label={playing ? 'Pausa' : 'Play'}
          className="absolute bottom-2 right-2 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-black shadow-lg transition-transform hover:scale-105"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>
        {track.file_url && <audio ref={audioRef} src={track.file_url} onEnded={onEnded} preload="none" />}
      </div>

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link href={`/catalog/${track.id}`} className="block truncate font-semibold text-white hover:text-emerald-400">
            {track.display_title || 'Senza titolo'}
          </Link>
          <p className="truncate text-sm text-zinc-500">{track.display_artist || 'Sconosciuto'}</p>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-600">
          {bucket && <span className="rounded-full border border-zinc-800 px-2 py-0.5 text-emerald-400/80">{bucket.label}</span>}
          {track.bpm != null && <span>{Math.round(track.bpm)} BPM</span>}
        </div>
        <div className="flex shrink-0 items-center gap-3 text-sm text-zinc-400">
          <button onClick={onLike} className="flex items-center gap-1 hover:text-emerald-400" aria-label="Like">
            <Heart className={`h-4 w-4 ${liked ? 'fill-emerald-500 text-emerald-500' : ''}`} />
            {likes > 0 && <span className="text-xs">{likes}</span>}
          </button>
          <button onClick={onSave} className="flex items-center gap-1 hover:text-emerald-400" aria-label="Salva">
            <Bookmark className={`h-4 w-4 ${saved ? 'fill-emerald-500 text-emerald-500' : ''}`} />
            {saves > 0 && <span className="text-xs">{saves}</span>}
          </button>
        </div>
      </div>
    </div>
  )
}
