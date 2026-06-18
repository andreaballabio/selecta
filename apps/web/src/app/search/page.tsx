import type { Metadata } from 'next'
import { Search as SearchIcon } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { hotScore } from '@/lib/social'
import { AppShell } from '@/components/app/app-shell'
import { SearchControls } from '@/components/search/search-controls'
import { TrackList } from '@/components/catalog/track-list'
import type { CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Cerca — Selecta' }

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

interface SP { q?: string; bucket?: string; key?: string; bpmMin?: string; bpmMax?: string; sort?: string }

export default async function SearchPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams
  const sb = createAdminClient()

  let query = sb.from('user_submissions').select(SELECT).eq('published', true)
  const text = (sp.q ?? '').replace(/[,()%*]/g, ' ').trim()
  if (text) query = query.or(`display_title.ilike.%${text}%,display_artist.ilike.%${text}%`)
  if (sp.bucket) query = query.eq('sound_bucket', sp.bucket)
  if (sp.key) query = query.eq('key', sp.key)
  const bpmMin = Number(sp.bpmMin), bpmMax = Number(sp.bpmMax)
  if (sp.bpmMin && !Number.isNaN(bpmMin)) query = query.gte('bpm', bpmMin)
  if (sp.bpmMax && !Number.isNaN(bpmMax)) query = query.lte('bpm', bpmMax)

  const { data } = await query.limit(120)
  let results = (data ?? []) as (CatalogTrack & { published_at: string })[]
  const sort = sp.sort ?? 'hot'
  results = [...results].sort((a, b) =>
    sort === 'new' ? (b.published_at ?? '').localeCompare(a.published_at ?? '')
    : sort === 'plays' ? (b.play_count ?? 0) - (a.play_count ?? 0)
    : hotScore(b) - hotScore(a),
  )

  const hasQuery = !!(sp.q || sp.bucket || sp.key || sp.bpmMin || sp.bpmMax)

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">Cerca</h1>
        <p className="mt-2 text-muted">Trova tracce per nome, artista, sottogenere, BPM e key.</p>
      </header>

      <SearchControls />

      <div className="mt-8">
        {!hasQuery ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted">
            <SearchIcon className="mx-auto mb-3 h-6 w-6 text-faint" />
            Inizia a digitare o usa i filtri per esplorare il catalogo.
          </div>
        ) : results.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted">
            Nessun risultato. Prova ad allargare i filtri.
          </div>
        ) : (
          <>
            <p className="mb-4 text-sm text-muted">{results.length} {results.length === 1 ? 'risultato' : 'risultati'}</p>
            <TrackList tracks={results} />
          </>
        )}
      </div>
    </AppShell>
  )
}
