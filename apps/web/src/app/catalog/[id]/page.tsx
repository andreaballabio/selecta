import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Play, Heart, Bookmark, ExternalLink } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { bucketByKey } from '@/lib/sound-bucket'
import { keyLabel } from '@/lib/camelot'
import { parseEmbedding, cosine } from '@/lib/embedding'
import { CatalogGrid, toPlayerTrack, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { CommentsSection, type CommentItem } from '@/components/catalog/comments-section'
import { Waveform } from '@/components/player/waveform'
import { AddToPlaylist } from '@/components/playlist/add-to-playlist'
import { RepostButton } from '@/components/catalog/repost-button'
import { TrackOwnerControls } from '@/components/catalog/track-owner-controls'
import { TrackVersions, type TrackVersion } from '@/components/catalog/track-versions'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, reposts_count, track_label, release_year, buy_url'

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('user_submissions').select('display_title, display_artist, published').eq('id', id).maybeSingle()
  if (!data || !(data as { published?: boolean }).published) return { title: 'Catalogo — Selecta' }
  const t = data as { display_title: string | null; display_artist: string | null }
  return { title: `${t.display_title ?? 'Traccia'}${t.display_artist ? ' — ' + t.display_artist : ''} · Selecta` }
}

async function resolveHandles(admin: ReturnType<typeof createAdminClient>, userIds: string[]) {
  const unique = [...new Set(userIds)].filter(Boolean)
  if (unique.length === 0) return new Map<string, { handle: string | null; name: string | null }>()
  const { data } = await admin.from('artist_profiles').select('user_id, handle, display_name').in('user_id', unique)
  const map = new Map<string, { handle: string | null; name: string | null }>()
  for (const r of (data ?? []) as { user_id: string; handle: string | null; display_name: string | null }[]) {
    map.set(r.user_id, { handle: r.handle, name: r.display_name })
  }
  return map
}

export default async function CatalogTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const admin = createAdminClient()
  const ssr = await createSsrClient()
  const { data: { user: viewer } } = await ssr.auth.getUser()

  const { data: track } = await admin
    .from('user_submissions')
    .select(`${SELECT}, audio_embedding, published, comments_count, user_id`)
    .eq('id', id)
    .maybeSingle()

  if (!track) notFound()
  const main = track as unknown as CatalogTrack & { audio_embedding: unknown; comments_count: number | null; published: boolean; user_id: string; track_label: string | null; release_year: number | null; buy_url: string | null }
  const isOwner = viewer?.id === main.user_id
  if (!main.published && !isOwner) notFound()
  const bucket = bucketByKey(main.sound_bucket)

  let pinned = false
  if (isOwner) {
    const { data: prof } = await admin.from('artist_profiles').select('spotlight').eq('user_id', main.user_id).maybeSingle()
    pinned = ((prof as { spotlight?: string[] } | null)?.spotlight ?? []).includes(id)
  }

  // Tracce simili (cosine fra embedding).
  const emb = parseEmbedding(main.audio_embedding)
  const { data: others } = await admin
    .from('user_submissions').select(`${SELECT}, audio_embedding`).eq('published', true).neq('id', id).limit(200)
  const similar: CatalogTrack[] = (others ?? [])
    .map((o) => ({ o: o as unknown as CatalogTrack, sim: cosine(emb, parseEmbedding((o as { audio_embedding: unknown }).audio_embedding)) }))
    .sort((a, b) => b.sim - a.sim).slice(0, 6).map(({ o }) => o)

  // Chi ha salvato / messo like + commenti + versioni.
  const [{ data: saveRows }, { data: likeRows }, { data: commentRows }, { data: versionRows }] = await Promise.all([
    admin.from('track_saves').select('user_id').eq('submission_id', id).limit(12),
    admin.from('track_likes').select('user_id').eq('submission_id', id).limit(12),
    admin.from('track_comments').select('id, body, created_at, user_id, position_sec').eq('submission_id', id).order('created_at', { ascending: false }).limit(50),
    admin.from('track_versions').select('id, label, file_url').eq('submission_id', id).order('position', { ascending: true }),
  ])
  const versions = (versionRows ?? []) as TrackVersion[]

  const handleMap = await resolveHandles(admin, [
    ...((saveRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ...((likeRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ...((commentRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
  ])

  const savers = ((saveRows ?? []) as { user_id: string }[]).map((r) => handleMap.get(r.user_id)).filter((x): x is { handle: string | null; name: string | null } => !!x && !!x.handle)
  const comments: CommentItem[] = ((commentRows ?? []) as { id: string; body: string; created_at: string | null; user_id: string; position_sec: number | null }[]).map((c) => {
    const a = handleMap.get(c.user_id)
    return { id: c.id, body: c.body, created_at: c.created_at, user_id: c.user_id, author_handle: a?.handle ?? null, author_name: a?.name ?? null, position_sec: c.position_sec }
  })
  const waveComments = comments.filter((c) => c.position_sec != null).map((c) => ({ pos: c.position_sec as number, body: c.body, author: c.author_name ?? c.author_handle }))

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/library" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Library
        </Link>

        <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
          <div className="max-w-[260px]">
            <CatalogGrid tracks={[main]} />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">{main.display_title || 'Senza titolo'}</h1>
            <p className="mt-1 text-lg text-muted">{main.display_artist || 'Sconosciuto'}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {!main.published && <span className="rounded-full bg-surface-2 px-3 py-1 text-xs font-bold uppercase tracking-wider text-faint">Bozza</span>}
              {bucket && <span className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-accent">{bucket.label}</span>}
              {main.genre && <span className="rounded-full border border-line px-3 py-1 text-text">{main.genre}</span>}
              {main.bpm != null && <span className="rounded-full border border-line px-3 py-1 text-text">{Math.round(main.bpm)} BPM</span>}
              {main.key && <span className="rounded-full border border-line px-3 py-1 text-text">{keyLabel(main.key, main.scale)}</span>}
              {main.track_label && <span className="rounded-full border border-line px-3 py-1 text-text">{main.track_label}</span>}
              {main.release_year && <span className="rounded-full border border-line px-3 py-1 text-text">{main.release_year}</span>}
            </div>

            <div className="mt-4 flex items-center gap-5 text-sm text-muted">
              <span className="flex items-center gap-1.5"><Play className="h-4 w-4" />{main.play_count ?? 0} ascolti</span>
              <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" />{main.likes_count ?? 0}</span>
              <span className="flex items-center gap-1.5"><Bookmark className="h-4 w-4" />{main.saves_count ?? 0} salvataggi</span>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <RepostButton submissionId={id} initialCount={(main as { reposts_count?: number }).reposts_count ?? 0} />
              <AddToPlaylist submissionId={id} />
              {main.buy_url && (
                <a href={main.buy_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-text hover:border-faint">
                  <ExternalLink className="h-4 w-4" /> Ascolta / Compra
                </a>
              )}
            </div>

            {isOwner && (
              <TrackOwnerControls
                submissionId={id}
                initialPinned={pinned}
                initial={{
                  display_title: main.display_title, display_artist: main.display_artist, cover_url: main.cover_url,
                  genre: main.genre, track_label: main.track_label, release_year: main.release_year, buy_url: main.buy_url, published: main.published,
                }}
              />
            )}

            {savers.length > 0 && (
              <p className="mt-4 text-sm text-muted">
                Salvata da{' '}
                {savers.slice(0, 6).map((s, i) => (
                  <span key={s.handle}>
                    <Link href={`/u/${s.handle}`} className="text-text hover:text-accent">@{s.handle}</Link>
                    {i < Math.min(savers.length, 6) - 1 ? ', ' : ''}
                  </span>
                ))}
                {savers.length > 6 && ` e altri ${savers.length - 6}`}
              </p>
            )}
          </div>
        </div>

        <div className="mt-8 rounded-2xl border border-line bg-surface/40 p-4">
          <Waveform track={toPlayerTrack(main)} comments={waveComments} />
        </div>

        <TrackVersions submissionId={id} trackTitle={main.display_title} trackArtist={main.display_artist} trackCover={main.cover_url} initial={versions} isOwner={isOwner} />

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-muted">Tracce simili</h2>
            <CatalogGrid tracks={similar} />
          </section>
        )}

        <CommentsSection submissionId={id} initialComments={comments} meId={viewer?.id ?? null} />
      </div>
    </div>
  )
}
