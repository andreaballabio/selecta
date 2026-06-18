import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ListMusic, Globe, Lock } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'
import { PlaylistTrackList } from '@/components/playlist/playlist-track-list'
import { PlaylistOwnerControls } from '@/components/playlist/playlist-owner-controls'
import type { CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'

const TRACK_FIELDS = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const sb = createAdminClient()
  const { data } = await sb.from('playlists').select('title, is_public').eq('id', id).maybeSingle()
  if (!data) return { title: 'Playlist — Selecta' }
  return { title: `${(data as { title: string }).title} — Playlist · Selecta` }
}

export default async function PlaylistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const sb = createAdminClient()
  const ssr = await createSsrClient()
  const { data: { user: viewer } } = await ssr.auth.getUser()

  const { data: pl } = await sb.from('playlists').select('id, user_id, title, description, cover_url, is_public, updated_at').eq('id', id).maybeSingle()
  if (!pl) notFound()
  const playlist = pl as { id: string; user_id: string; title: string; description: string | null; cover_url: string | null; is_public: boolean }
  const isOwner = viewer?.id === playlist.user_id
  if (!playlist.is_public && !isOwner) notFound()

  const { data: rows } = await sb
    .from('playlist_tracks')
    .select(`position, user_submissions(${TRACK_FIELDS}, published)`)
    .eq('playlist_id', id)
    .order('position', { ascending: true })
  const tracks = ((rows ?? []) as unknown as { user_submissions: (CatalogTrack & { published?: boolean }) | (CatalogTrack & { published?: boolean })[] | null }[])
    .map((r) => (Array.isArray(r.user_submissions) ? r.user_submissions[0] : r.user_submissions))
    .filter((t): t is CatalogTrack & { published?: boolean } => !!t && t.published === true)

  const { data: owner } = await sb.from('artist_profiles').select('handle, display_name').eq('user_id', playlist.user_id).maybeSingle()
  const ownerName = (owner as { display_name?: string } | null)?.display_name ?? 'Artista'
  const ownerHandle = (owner as { handle?: string } | null)?.handle
  const cover = playlist.cover_url || tracks[0]?.cover_url || null

  return (
    <AppShell>
      <header className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-end">
        <div className="h-44 w-44 shrink-0 overflow-hidden rounded-2xl bg-surface-2">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt="" className="h-full w-full object-cover" />
          ) : <div className="flex h-full w-full items-center justify-center text-faint"><ListMusic className="h-10 w-10" /></div>}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            {playlist.is_public ? <Globe className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />} Playlist
          </p>
          <h1 className="mt-2 font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">{playlist.title}</h1>
          {playlist.description && <p className="mt-2 text-muted">{playlist.description}</p>}
          <p className="mt-3 text-sm text-muted">
            di {ownerHandle ? <Link href={`/u/${ownerHandle}`} className="text-text hover:text-accent">{ownerName}</Link> : ownerName}
            {' · '}{tracks.length} {tracks.length === 1 ? 'traccia' : 'tracce'}
          </p>
          {isOwner && <div className="mt-4"><PlaylistOwnerControls playlistId={id} isPublic={playlist.is_public} /></div>}
        </div>
      </header>

      <PlaylistTrackList initial={tracks} playlistId={id} isOwner={isOwner} />
    </AppShell>
  )
}
