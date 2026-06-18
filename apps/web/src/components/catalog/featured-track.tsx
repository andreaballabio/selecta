'use client'

import Link from 'next/link'
import { Play, Pause } from 'lucide-react'
import { usePlayer } from '@/components/player/player-context'
import { bucketByKey } from '@/lib/sound-bucket'
import type { CatalogTrack } from './catalog-grid'

export function FeaturedTrack({ track }: { track: CatalogTrack }) {
  const player = usePlayer()
  const bucket = bucketByKey(track.sound_bucket)
  const initials = (track.display_title || '?').trim().slice(0, 2).toUpperCase()
  const isCurrent = player.current?.id === track.id
  const isPlaying = isCurrent && player.playing

  const play = () => {
    if (isCurrent) { player.togglePlay(); return }
    player.playQueue([{
      id: track.id, title: track.display_title, artist: track.display_artist,
      cover_url: track.cover_url, file_url: track.file_url, bucketLabel: bucket?.label ?? null,
    }], 0)
  }

  return (
    <div className="relative overflow-hidden rounded-[2rem] border border-line bg-surface/50">
      <div className="grid gap-6 p-5 sm:grid-cols-[minmax(0,260px)_1fr] sm:p-7">
        <div className="relative aspect-square overflow-hidden rounded-2xl bg-surface-2">
          {track.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-6xl font-bold text-faint">{initials}</div>
          )}
        </div>
        <div className="flex flex-col justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">In evidenza{bucket ? ` · ${bucket.label}` : ''}</p>
          <Link href={`/catalog/${track.id}`} className="mt-2 font-display text-3xl font-bold tracking-tight text-text hover:text-accent sm:text-4xl">
            {track.display_title || 'Senza titolo'}
          </Link>
          <p className="mt-1 text-lg text-muted">{track.display_artist || 'Sconosciuto'}</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
            {track.bpm != null && <span className="rounded-full border border-line px-3 py-1">{Math.round(track.bpm)} BPM</span>}
            {track.key && <span className="rounded-full border border-line px-3 py-1">{track.key}{track.scale ? ' ' + track.scale : ''}</span>}
            {(track.play_count ?? 0) > 0 && <span className="rounded-full border border-line px-3 py-1">{track.play_count} ascolti</span>}
          </div>
          <button
            onClick={play}
            className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform hover:scale-[1.03]"
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
            {isPlaying ? 'In riproduzione' : 'Ascolta ora'}
          </button>
        </div>
      </div>
    </div>
  )
}
