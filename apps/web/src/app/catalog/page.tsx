import Link from 'next/link'
import type { Metadata } from 'next'
import { Sparkles } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKETS } from '@/lib/sound-bucket'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Catalogo — Selecta',
  description: 'Il catalogo di Tech House non firmata, organizzato per come suona. Ascolta, scopri, metti like.',
}

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count'

export default async function CatalogPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket } = await searchParams
  const supabase = createAdminClient()

  let query = supabase
    .from('user_submissions')
    .select(SELECT)
    .eq('published', true)
    .order('likes_count', { ascending: false })
    .order('published_at', { ascending: false })
    .limit(60)
  if (bucket) query = query.eq('sound_bucket', bucket)

  const { data } = await query
  const tracks = (data ?? []) as CatalogTrack[]

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Catalogo</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Tech House, organizzata per come suona</h1>
          <p className="mt-2 max-w-2xl text-zinc-400">
            Tracce pubblicate dai producer e raggruppate dall'AI per sound. Ascolta, scopri quello che gira, metti like.
          </p>
        </header>

        {/* Filtri per sound bucket */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Link
            href="/catalog"
            className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
              !bucket ? 'bg-emerald-500 text-black' : 'border border-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            Tutto
          </Link>
          {BUCKETS.map((b) => (
            <Link
              key={b.key}
              href={`/catalog?bucket=${b.key}`}
              title={b.blurb}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                bucket === b.key ? 'bg-emerald-500 text-black' : 'border border-zinc-800 text-zinc-400 hover:text-white'
              }`}
            >
              {b.label}
            </Link>
          ))}
        </div>

        <CatalogGrid tracks={tracks} />

        <div className="mt-10 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-6 text-center">
          <h2 className="text-lg font-semibold text-white">Vuoi che la tua traccia entri nel catalogo?</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-zinc-400">
            Analizzala gratis: scopri le label compatibili e, se vuoi, pubblicala qui. La ascolteranno DJ e label.
          </p>
          <Link href="/match" className="mt-4 inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-2.5 font-semibold text-black transition-colors hover:bg-emerald-400">
            <Sparkles className="h-4 w-4" /> Analizza la tua traccia
          </Link>
        </div>
      </div>
    </div>
  )
}
