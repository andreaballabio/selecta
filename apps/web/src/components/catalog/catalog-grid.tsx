'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, Heart, Bookmark, Music } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { bucketByKey } from '@/lib/sound-bucket'
import { usePlayer, type PlayerTrack } from '@/components/player/player-context'

export function toPlayerTrack(t: CatalogTrack): PlayerTrack {
  return {
    id: t.id, title: t.display_title, artist: t.display_artist,
    cover_url: t.cover_url, file_url: t.file_url,
    bucketLabel: bucketByKey(t.sound_bucket)?.label ?? null,
  }
}

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
      <div className="glass rounded-3xl p-12 text-center text-muted">
        <Music className="mx-auto mb-3 h-6 w-6 text-faint" />
        Ancora nessuna traccia qui. Analizza la tua e pubblicala nel catalogo.
      </div>
    )
  }

  const playerList = tracks.map(toPlayerTrack)

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
      {tracks.map((t, i) => (
        <TrackCard
          key={t.id}
          track={t}
          list={playerList}
          index={i}
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
  track, list, index, liked, saved, likes, saves, onLike, onSave,
}: {
  track: CatalogTrack
  list: PlayerTrack[]; index: number
  liked: boolean; saved: boolean; likes: number; saves: number
  onLike: () => void; onSave: () => void
}) {
  const player = usePlayer()
  const bucket = bucketByKey(track.sound_bucket)
  const initials = (track.display_title || '?').trim().slice(0, 2).toUpperCase()
  const isCurrent = player.current?.id === track.id
  const isPlaying = isCurrent && player.playing

  const play = () => { if (isCurrent) player.togglePlay(); else player.playQueue(list, index) }

  return (
    <div className="group glass glass-hover rounded-2xl p-2.5">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-xl bg-surface-2">
        {track.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.cover_url} alt={track.display_title ?? ''} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full w-full items-center justify-center font-display text-4xl font-bold text-faint">{initials}</div>
        )}
        <div className={`absolute inset-0 bg-gradient-to-t from-black/60 to-transparent transition-opacity duration-300 ${isCurrent ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`} />

        <button
          onClick={play}
          aria-label={isPlaying ? 'Pausa' : 'Play'}
          className={`absolute bottom-2.5 right-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-accent-ink shadow-xl transition-all duration-300 hover:scale-105 ${
            isCurrent ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100'
          }`}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
        </button>

        {isPlaying && (
          <div className="absolute bottom-3.5 left-3 flex items-end gap-0.5" aria-hidden>
            {[0, 1, 2].map((i) => (
              <span key={i} className="eq-bar w-0.5 rounded-full bg-accent" style={{ height: 12, animationDelay: `${i * 0.14}s` }} />
            ))}
          </div>
        )}
      </div>

      <div className="px-1">
        <Link href={`/catalog/${track.id}`} className="block truncate font-semibold text-text transition-colors hover:text-accent">
          {track.display_title || 'Senza titolo'}
        </Link>
        <p className="truncate text-sm text-muted">{track.display_artist || 'Sconosciuto'}</p>

        <div className="mt-2.5 flex items-center justify-between border-t border-line pt-2.5">
          <span className="truncate text-[11px] font-medium uppercase tracking-wider text-faint">{bucket?.label ?? track.genre ?? 'Tech House'}</span>
          <div className="flex shrink-0 items-center gap-2.5 text-muted">
            <button onClick={onLike} className="flex items-center gap-1 text-xs transition-colors hover:text-accent" aria-label="Like">
              <Heart className={`h-4 w-4 ${liked ? 'fill-accent text-accent' : ''}`} />
              {likes > 0 && <span>{likes}</span>}
            </button>
            <button onClick={onSave} className="flex items-center gap-1 text-xs transition-colors hover:text-accent" aria-label="Salva">
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-accent text-accent' : ''}`} />
              {saves > 0 && <span>{saves}</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
