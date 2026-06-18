'use client'

import { useState } from 'react'
import { Play } from 'lucide-react'
import { usePlayer } from '@/components/player/player-context'
import { TrackList } from '@/components/catalog/track-list'
import { toPlayerTrack, type CatalogTrack } from '@/components/catalog/catalog-grid'

export function PlaylistTrackList({ initial, playlistId, isOwner }: { initial: CatalogTrack[]; playlistId: string; isOwner: boolean }) {
  const [tracks, setTracks] = useState(initial)
  const player = usePlayer()

  const playAll = () => { if (tracks.length) player.playQueue(tracks.map(toPlayerTrack), 0) }
  const remove = async (id: string) => {
    setTracks((t) => t.filter((x) => x.id !== id))
    fetch(`/api/playlists/${playlistId}/tracks`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: id }) }).catch(() => {})
  }

  if (tracks.length === 0) {
    return <p className="rounded-2xl border border-dashed border-line bg-surface/40 p-10 text-center text-muted">Playlist vuota. Aggiungi tracce dal catalogo.</p>
  }
  return (
    <div>
      <button onClick={playAll} className="mb-5 inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 font-semibold text-accent-ink transition-transform hover:scale-[1.02]">
        <Play className="h-5 w-5" /> Riproduci
      </button>
      <TrackList tracks={tracks} numbered onRemove={isOwner ? remove : undefined} />
    </div>
  )
}
