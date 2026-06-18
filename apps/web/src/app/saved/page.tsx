import Link from 'next/link'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Bookmark, ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'I miei salvati — Selecta' }

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count'

export default async function SavedPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()
  const { data: saves } = await admin
    .from('track_saves')
    .select('submission_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const ids = ((saves ?? []) as { submission_id: string }[]).map((s) => s.submission_id)
  let tracks: CatalogTrack[] = []
  if (ids.length > 0) {
    const { data } = await admin.from('user_submissions').select(SELECT).in('id', ids).eq('published', true)
    const byId = new Map((data ?? []).map((t) => [(t as CatalogTrack).id, t as CatalogTrack]))
    tracks = ids.map((id) => byId.get(id)).filter((t): t is CatalogTrack => !!t)
  }

  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/dashboard" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Dashboard
        </Link>
        <header className="mb-8">
          <h1 className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight text-text">
            <Bookmark className="h-6 w-6 text-accent" /> I miei salvati
          </h1>
          <p className="mt-1 text-sm text-muted">Le tracce che hai messo in crate dal catalogo.</p>
        </header>

        {tracks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-10 text-center text-muted">
            Non hai ancora salvato tracce. <Link href="/library" className="text-accent hover:underline">Esplora la library.</Link>
          </div>
        ) : (
          <CatalogGrid tracks={tracks} />
        )}
      </div>
    </div>
  )
}
