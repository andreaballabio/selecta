'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Sparkles, Music2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { FollowButton } from './follow-button'

export interface ArtistItem {
  user_id: string
  handle: string | null
  display_name: string | null
  tagline: string | null
  photo_url: string | null
  descriptors: string[]
  bpmRange: string | null
  trackCount: number
  affinity?: number // 0..1, "match" col mio suono
}

export function ArtistsList({ artists }: { artists: ArtistItem[] }) {
  const [followingSet, setFollowingSet] = useState<Set<string>>(new Set())
  const [me, setMe] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      setMe(user?.id ?? null)
      if (user) {
        const { data } = await (supabase as any).from('follows').select('following_id').eq('follower_id', user.id)
        if (data) setFollowingSet(new Set(data.map((r: { following_id: string }) => r.following_id)))
      }
      setLoaded(true)
    })()
  }, [])

  if (artists.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
        Ancora nessun artista. Crea la tua press kit per comparire qui.
      </div>
    )
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {artists.map((a) => {
        const initials = (a.display_name || a.handle || '?').trim().slice(0, 2).toUpperCase()
        return (
          <div key={a.user_id} className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4">
            <div className="flex items-center gap-3">
              {a.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={a.photo_url} alt={a.display_name ?? ''} className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 font-bold text-emerald-300">{initials}</div>
              )}
              <div className="min-w-0 flex-1">
                <Link href={a.handle ? `/u/${a.handle}` : '#'} className="block truncate font-semibold text-white hover:text-emerald-400">
                  {a.display_name || a.handle || 'Artista'}
                </Link>
                {a.tagline && <p className="truncate text-sm text-zinc-500">{a.tagline}</p>}
              </div>
            </div>

            {a.affinity !== undefined && (
              <div className="mt-3 flex items-center gap-1.5 text-xs text-emerald-400">
                <Sparkles className="h-3.5 w-3.5" /> {Math.round(a.affinity * 100)}% affinità col tuo suono
              </div>
            )}

            {a.descriptors.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.descriptors.slice(0, 4).map((d) => (
                  <span key={d} className="rounded-full border border-zinc-800 px-2 py-0.5 text-xs text-zinc-400">{d}</span>
                ))}
              </div>
            )}

            <div className="mt-3 flex items-center justify-between">
              <span className="flex items-center gap-1 text-xs text-zinc-600">
                <Music2 className="h-3.5 w-3.5" /> {a.trackCount} {a.trackCount === 1 ? 'traccia' : 'tracce'}
                {a.bpmRange && <span>· {a.bpmRange} BPM</span>}
              </span>
              <FollowButton
                key={`${a.user_id}-${loaded}`}
                targetUserId={a.user_id}
                initialFollowing={followingSet.has(a.user_id)}
                isSelf={me === a.user_id}
                compact
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}
