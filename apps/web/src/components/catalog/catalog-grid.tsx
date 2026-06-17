'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, Heart, Bookmark, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { bucketByKey } from '@/lib/sound-bucket'
import { usePlayer } from '@/components/player/player-context'

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
  const [likedIds, setLikedIds] = useState<Set<string>>(new Set())
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set())
  const [likes, setLikes] = useState<Record<string, number>>(() => Object.fromEntries(tracks.map((t) => [t.id, t.likes_count ?? 0])))
  const [saves, setSaves] = useState<Record<string, number>>(() => Object.fromEntries(tracks.map((t) => [t.id, t.saves_count ?? 0])))
  const [authed, setAuthed] = useState(false)

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
    ids: Set<string>, setIds: React.Dispatch<React.SetStateAction<Set<string>>>,
    setCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>,
  ) => {
    if (!requireAuth()) return
    const was = ids.has(id)
    setIds((prev) => { const n = new Set(prev); if (was) n.delete(id); else n.add(id); return n })
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

  if (tracks.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
        <Music className="mx-auto mb-3 h-6 w-6 text-zinc-700" />
        Ancora nessuna traccia qui. Analizza la tua e pubblicala nel catalogo.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {tracks.map((t) => (
        <TrackCard
          key={t.id}
          track={t}
          liked={likedIds.has(t.id)}
          saved={savedIds.has(t.id)}
          likes={likes[t.id] ?? 0}
          saves={saves[t.id] ?? 0}
          onLike={() => toggle(t.id, 'like', likedIds, setLikedIds, setLikes)}
          onSave={() => toggle(t.id, 'save', savedIds, setSavedIds, setSaves)}
        />
      ))}
    </div>
  )
}

function TrackCard({
  track, liked, saved, likes, saves, onLike, onSave,
}: {
  track: CatalogTrack
  liked: boolean; saved: boolean; likes: number; saves: number
  onLike: () => void; onSave: () => void
}) {
  const player = usePlayer()
  const bucket = bucketByKey(track.sound_bucket)
  const initials = (track.display_title || '?').trim().slice(0, 2).toUpperCase()
  const isCurrent = player.current?.id === track.id
  const isPlaying = isCurrent && player.playing

  const play = () => player.toggle({
    id: track.id,
    title: track.display_title,
    artist: track.display_artist,
    cover_url: track.cover_url,
    file_url: track.file_url,
    bucketLabel: bucket?.label ?? null,
  })

  return (
    <div className="group rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-2.5 transition-all duration-300 hover:border-emerald-500/30 hover:bg-zinc-900/40">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/10">
        {track.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.cover_url} alt={track.display_title ?? ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-emerald-300/60">{initials}</div>
        )}

        {/* Overlay scuro al hover / quando attiva */}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0 transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

        <button
          onClick={play}
          aria-label={isPlaying ? 'Pausa' : 'Play'}
          className={`absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-500 text-black shadow-xl shadow-emerald-500/20 transition-all duration-300 hover:scale-105 ${
            isCurrent ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
          }`}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>

        {isPlaying && (
          <div className="absolute bottom-3.5 left-3 flex items-end gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="eq-bar w-0.5 rounded-full bg-emerald-400" style={{ height: 12, animationDelay: `${i * 0.14}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="px-1">
        <Link href={`/catalog/${track.id}`} className="block truncate font-semibold text-white transition-colors hover:text-emerald-400">
          {track.display_title || 'Senza titolo'}
        </Link>
        <p className="truncate text-sm text-zinc-500">{track.display_artist || 'Sconosciuto'}</p>

        <div className="mt-2.5 flex items-center justify-between border-t border-zinc-800/60 pt-2.5">
          <span className="truncate text-[11px] font-medium text-emerald-400/80">{bucket?.label ?? track.genre ?? 'Tech House'}</span>
          <div className="flex shrink-0 items-center gap-2.5 text-zinc-400">
            <button onClick={onLike} className="flex items-center gap-1 text-xs transition-colors hover:text-emerald-400" aria-label="Like">
              <Heart className={`h-4 w-4 ${liked ? 'fill-emerald-500 text-emerald-500' : ''}`} />
              {likes > 0 && <span>{likes}</span>}
            </button>
            <button onClick={onSave} className="flex items-center gap-1 text-xs transition-colors hover:text-emerald-400" aria-label="Salva">
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-emerald-500 text-emerald-500' : ''}`} />
              {saves > 0 && <span>{saves}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
