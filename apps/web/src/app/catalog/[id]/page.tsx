import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft, Play, Heart, Bookmark } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { bucketByKey } from '@/lib/sound-bucket'
import { parseEmbedding, cosine } from '@/lib/embedding'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { CommentsSection, type CommentItem } from '@/components/catalog/comments-section'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count'

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
    .select(`${SELECT}, audio_embedding, published, comments_count`)
    .eq('id', id)
    .maybeSingle()

  if (!track || !(track as { published?: boolean }).published) notFound()
  const main = track as unknown as CatalogTrack & { audio_embedding: unknown; comments_count: number | null }
  const bucket = bucketByKey(main.sound_bucket)

  // Tracce simili (cosine fra embedding).
  const emb = parseEmbedding(main.audio_embedding)
  const { data: others } = await admin
    .from('user_submissions').select(`${SELECT}, audio_embedding`).eq('published', true).neq('id', id).limit(200)
  const similar: CatalogTrack[] = (others ?? [])
    .map((o) => ({ o: o as unknown as CatalogTrack, sim: cosine(emb, parseEmbedding((o as { audio_embedding: unknown }).audio_embedding)) }))
    .sort((a, b) => b.sim - a.sim).slice(0, 6).map(({ o }) => o)

  // Chi ha salvato / messo like + commenti.
  const [{ data: saveRows }, { data: likeRows }, { data: commentRows }] = await Promise.all([
    admin.from('track_saves').select('user_id').eq('submission_id', id).limit(12),
    admin.from('track_likes').select('user_id').eq('submission_id', id).limit(12),
    admin.from('track_comments').select('id, body, created_at, user_id').eq('submission_id', id).order('created_at', { ascending: false }).limit(50),
  ])

  const handleMap = await resolveHandles(admin, [
    ...((saveRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ...((likeRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
    ...((commentRows ?? []) as { user_id: string }[]).map((r) => r.user_id),
  ])

  const savers = ((saveRows ?? []) as { user_id: string }[]).map((r) => handleMap.get(r.user_id)).filter((x): x is { handle: string | null; name: string | null } => !!x && !!x.handle)
  const comments: CommentItem[] = ((commentRows ?? []) as { id: string; body: string; created_at: string | null; user_id: string }[]).map((c) => {
    const a = handleMap.get(c.user_id)
    return { id: c.id, body: c.body, created_at: c.created_at, user_id: c.user_id, author_handle: a?.handle ?? null, author_name: a?.name ?? null }
  })

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/catalog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Catalogo
        </Link>

        <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
          <div className="max-w-[260px]">
            <CatalogGrid tracks={[main]} />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-bold text-white">{main.display_title || 'Senza titolo'}</h1>
            <p className="mt-1 text-lg text-zinc-400">{main.display_artist || 'Sconosciuto'}</p>

            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {bucket && <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">{bucket.label}</span>}
              {main.genre && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{main.genre}</span>}
              {main.bpm != null && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{Math.round(main.bpm)} BPM</span>}
              {main.key && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{main.key}{main.scale ? ' ' + main.scale : ''}</span>}
            </div>

            <div className="mt-4 flex items-center gap-5 text-sm text-zinc-400">
              <span className="flex items-center gap-1.5"><Play className="h-4 w-4" />{main.play_count ?? 0} ascolti</span>
              <span className="flex items-center gap-1.5"><Heart className="h-4 w-4" />{main.likes_count ?? 0}</span>
              <span className="flex items-center gap-1.5"><Bookmark className="h-4 w-4" />{main.saves_count ?? 0} salvataggi</span>
            </div>

            {savers.length > 0 && (
              <p className="mt-4 text-sm text-zinc-500">
                Salvata da{' '}
                {savers.slice(0, 6).map((s, i) => (
                  <span key={s.handle}>
                    <Link href={`/u/${s.handle}`} className="text-zinc-300 hover:text-emerald-400">@{s.handle}</Link>
                    {i < Math.min(savers.length, 6) - 1 ? ', ' : ''}
                  </span>
                ))}
                {savers.length > 6 && ` e altri ${savers.length - 6}`}
              </p>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Tracce simili</h2>
            <CatalogGrid tracks={similar} />
          </section>
        )}

        <CommentsSection submissionId={id} initialComments={comments} meId={viewer?.id ?? null} />
      </div>
    </div>
  )
}
