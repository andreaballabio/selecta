'use client'

import Link from 'next/link'
import { Play, Pause } from 'lucide-react'
import { usePlayer } from '@/components/player/player-context'
import { bucketByKey } from '@/lib/sound-bucket'
import type { CatalogTrack } from './catalog-grid'

/* Traccia in evidenza — pannello "INK" a contrasto pieno (nero su tema chiaro,
   bianco su tema scuro): il momento editoriale della pagina, stile Apple Music.
   Tipografia gigante, dati tecnici in mono, equalizer che suona col player. */

// altezze deterministiche (niente Math.random → niente hydration mismatch)
const eqHeights = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const v = Math.abs(Math.sin(i * 0.9) * 0.6 + Math.sin(i * 0.31) * 0.4)
    return 6 + Math.round(v * 26)
  })

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
    <div className="relative overflow-hidden rounded-[2rem] bg-text text-bg shadow-2xl">
      {/* alone morbido dietro il contenuto */}
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full opacity-[0.07] blur-3xl" style={{ background: 'radial-gradient(circle, var(--bg), transparent 70%)' }} />

      <div className="relative grid gap-8 p-6 sm:grid-cols-[minmax(0,240px)_1fr] sm:p-10">
        <Link href={`/catalog/${track.id}`} className="group relative aspect-square overflow-hidden rounded-2xl bg-bg/10">
          {track.cover_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.cover_url} alt="" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.04]" />
          ) : (
            <div className="flex h-full w-full items-center justify-center font-display text-7xl font-semibold text-bg/25">{initials}</div>
          )}
        </Link>

        <div className="flex min-w-0 flex-col justify-center">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-bg/50">In evidenza{bucket ? ` · ${bucket.label}` : ''}</p>
          <Link href={`/catalog/${track.id}`} className="mt-3 block truncate font-display display-tight text-4xl font-semibold tracking-tight hover:opacity-80 sm:text-6xl">
            {track.display_title || 'Senza titolo'}
          </Link>
          <p className="mt-2 text-xl text-bg/60">{track.display_artist || 'Sconosciuto'}</p>

          <div className="mt-5 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-mono text-sm text-bg/60">
            {track.bpm != null && <span><span className="text-2xl font-medium text-bg">{Math.round(track.bpm)}</span> BPM</span>}
            {track.key && <span><span className="text-2xl font-medium text-bg">{track.key}</span>{track.scale ? ` ${track.scale}` : ''}</span>}
            {(track.play_count ?? 0) > 0 && <span><span className="text-2xl font-medium text-bg">{(track.play_count ?? 0).toLocaleString('it-IT')}</span> ascolti</span>}
          </div>

          <div className="mt-7 flex items-center gap-5">
            <button
              onClick={play}
              className="inline-flex w-fit items-center gap-2 rounded-full bg-bg px-7 py-3.5 font-semibold text-text shadow-xl transition-transform hover:scale-[1.04]"
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5" />}
              {isPlaying ? 'In riproduzione' : 'Ascolta ora'}
            </button>
            {/* equalizer: vivo quando suona, fermo altrimenti */}
            <span aria-hidden className="hidden h-9 items-end gap-[3px] sm:flex">
              {eqHeights(24).map((h, i) => (
                <span
                  key={i}
                  className={`w-[3px] rounded-full ${isPlaying ? 'eq-bar bg-bg/80' : 'bg-bg/25'}`}
                  style={{ height: h, animationDelay: `${(i % 7) * 0.11}s` }}
                />
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
