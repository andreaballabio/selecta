'use client'

import { Play } from 'lucide-react'
import { usePlayer } from '@/components/player/player-context'
import { TrackList } from './track-list'
import { toPlayerTrack, type CatalogTrack } from './catalog-grid'

/** Lista con bottone "Riproduci tutto" che accoda l'intera lista. */
export function PlayAllList({ tracks, numbered = true, label = 'Riproduci' }: { tracks: CatalogTrack[]; numbered?: boolean; label?: string }) {
  const player = usePlayer()
  if (tracks.length === 0) return null
  return (
    <div>
      <button onClick={() => player.playQueue(tracks.map(toPlayerTrack), 0)} className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform hover:scale-[1.02]">
        <Play className="h-5 w-5" /> {label}
      </button>
      <TrackList tracks={tracks} numbered={numbered} />
    </div>
  )
}
