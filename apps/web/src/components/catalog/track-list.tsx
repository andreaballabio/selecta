'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, Pause, Heart, Bookmark, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { bucketByKey } from '@/lib/sound-bucket'
import { usePlayer } from '@/components/player/player-context'
import { toPlayerTrack, type CatalogTrack } from './catalog-grid'

export function TrackList({ tracks, numbered = false, onRemove }: { tracks: CatalogTrack[]; numbered?: boolean; onRemove?: (id: string) => void }) {
  const player = usePlayer()
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

  const toggleMeta = async (id: string, kind: 'like' | 'save') => {
    if (!authed) { window.location.href = '/auth/login'; return }
    const ids = kind === 'like' ? likedIds : savedIds
    const setIds = kind === 'like' ? setLikedIds : setSavedIds
    const setCounts = kind === 'like' ? setLikes : setSaves
    const was = ids.has(id)
    setIds((prev) => { const n = new Set(prev); if (was) n.delete(id); else n.add(id); return n })
    setCounts((prev) => ({ ...prev, [id]: Math.max(0, (prev[id] ?? 0) + (was ? -1 : 1)) }))
    try {
      const res = await fetch(`/api/catalog/${kind}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: id }) })
      const data = await res.json()
      const c = kind === 'like' ? data.likes_count : data.saves_count
      if (typeof c === 'number') setCounts((prev) => ({ ...prev, [id]: c }))
    } catch { /* noop */ }
  }

  const playerList = tracks.map(toPlayerTrack)

  return (
    <div className="glass overflow-hidden rounded-2xl">
      {tracks.map((t, i) => {
        const isCurrent = player.current?.id === t.id
        const isPlaying = isCurrent && player.playing
        const bucket = bucketByKey(t.sound_bucket)
        const play = () => { if (isCurrent) player.togglePlay(); else player.playQueue(playerList, i) }
        return (
          <div
            key={t.id}
            className={`group grid grid-cols-[2rem_1fr_auto] items-center gap-3 border-b border-line px-3 py-2.5 last:border-0 sm:grid-cols-[2rem_minmax(0,1fr)_8rem_5rem_auto] sm:px-4 ${isCurrent ? 'bg-surface-2/60' : 'hover:bg-surface/60'}`}
          >
            {/* indice / play */}
            <button onClick={play} className="flex h-8 w-8 items-center justify-center text-sm tabular-nums text-muted" aria-label={isPlaying ? 'Pausa' : 'Play'}>
              <span className={`${isCurrent ? 'hidden' : 'group-hover:hidden'}`}>{numbered ? i + 1 : ''}</span>
              <span className={`${isCurrent ? 'block text-accent' : 'hidden group-hover:block text-text'}`}>
                {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              </span>
              {!numbered && !isCurrent && <Play className="h-4 w-4 group-hover:hidden" />}
            </button>

            {/* cover + titolo */}
            <div className="flex min-w-0 items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-surface-2">
                {t.cover_url
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.cover_url} alt="" className="h-full w-full object-cover" />
                  : <div className="flex h-full w-full items-center justify-center text-[10px] font-bold text-faint">{(t.display_title || '?').slice(0, 2).toUpperCase()}</div>}
              </div>
              <div className="min-w-0">
                <Link href={`/catalog/${t.id}`} className={`block truncate text-sm font-medium hover:underline ${isCurrent ? 'text-accent' : 'text-text'}`}>
                  {t.display_title || 'Senza titolo'}
                </Link>
                <p className="truncate text-xs text-muted">{t.display_artist || 'Sconosciuto'}</p>
              </div>
            </div>

            {/* bucket (desktop) */}
            <span className="hidden truncate text-xs text-muted sm:block">{bucket?.label ?? t.genre ?? 'Tech House'}</span>
            {/* ascolti (desktop) */}
            <span className="hidden text-right text-xs tabular-nums text-muted sm:block">{(t.play_count ?? 0).toLocaleString('it-IT')}</span>

            {/* azioni */}
            <div className="flex items-center justify-end gap-3 text-muted">
              <button onClick={() => toggleMeta(t.id, 'like')} className="flex items-center gap-1 text-xs hover:text-accent" aria-label="Like">
                <Heart className={`h-4 w-4 ${likedIds.has(t.id) ? 'fill-accent text-accent' : ''}`} />
                <span className="hidden sm:inline">{likes[t.id] ?? 0}</span>
              </button>
              <button onClick={() => toggleMeta(t.id, 'save')} className="flex items-center gap-1 text-xs hover:text-accent" aria-label="Salva">
                <Bookmark className={`h-4 w-4 ${savedIds.has(t.id) ? 'fill-accent text-accent' : ''}`} />
              </button>
              {onRemove && <button onClick={() => onRemove(t.id)} className="text-faint hover:text-text" aria-label="Rimuovi dalla playlist"><X className="h-4 w-4" /></button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
