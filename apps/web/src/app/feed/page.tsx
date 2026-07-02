import Link from 'next/link'
import type { Metadata } from 'next'
import { Rss, LogIn, Users } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'
import { TrackList } from '@/components/catalog/track-list'
import type { CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Feed — Selecta' }

const FIELDS = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

export default async function FeedPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl glass p-12 text-center">
          <Rss className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Il tuo Feed</h1>
          <p className="mt-2 text-muted">Accedi e segui artisti per riempire il tuo feed con le loro uscite e i loro repost.</p>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }

  const sb = createAdminClient()
  const { data: follows } = await sb.from('follows').select('following_id').eq('follower_id', user.id)
  const followingIds = ((follows ?? []) as { following_id: string }[]).map((f) => f.following_id)

  if (followingIds.length === 0) {
    return (
      <AppShell>
        <header className="mb-6"><h1 className="font-display text-4xl font-bold tracking-tight text-text">Feed</h1></header>
        <div className="rounded-2xl glass border-dashed p-12 text-center text-muted">
          Non segui ancora nessuno. <Link href="/artists" className="text-accent hover:underline">Trova artisti</Link> da seguire.
        </div>
      </AppShell>
    )
  }

  const [{ data: published }, { data: reposts }] = await Promise.all([
    sb.from('user_submissions').select(FIELDS).eq('published', true).in('user_id', followingIds).order('published_at', { ascending: false }).limit(40),
    sb.from('reposts').select('submission_id, created_at').in('user_id', followingIds).order('created_at', { ascending: false }).limit(40),
  ])

  const items = new Map<string, { t: CatalogTrack; ts: string }>()
  for (const t of (published ?? []) as (CatalogTrack & { published_at: string })[]) items.set(t.id, { t, ts: t.published_at })

  const repostIds = [...new Set(((reposts ?? []) as { submission_id: string }[]).map((r) => r.submission_id))].filter((id) => !items.has(id))
  if (repostIds.length) {
    const { data: rt } = await sb.from('user_submissions').select(FIELDS).eq('published', true).in('id', repostIds)
    const repostTs = new Map(((reposts ?? []) as { submission_id: string; created_at: string }[]).map((r) => [r.submission_id, r.created_at]))
    for (const t of (rt ?? []) as CatalogTrack[]) items.set(t.id, { t, ts: repostTs.get(t.id) ?? '' })
  }

  const tracks = [...items.values()].sort((a, b) => (b.ts ?? '').localeCompare(a.ts ?? '')).map((x) => x.t)

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">Feed</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-muted"><Users className="h-4 w-4" /> Da {followingIds.length} {followingIds.length === 1 ? 'artista' : 'artisti'} che segui</p>
      </header>
      {tracks.length === 0 ? (
        <div className="rounded-2xl glass border-dashed p-12 text-center text-muted">Ancora niente di nuovo dai tuoi artisti.</div>
      ) : <TrackList tracks={tracks} />}
    </AppShell>
  )
}
