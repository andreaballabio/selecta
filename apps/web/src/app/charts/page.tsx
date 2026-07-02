import Link from 'next/link'
import type { Metadata } from 'next'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKETS } from '@/lib/sound-bucket'
import { hotScore } from '@/lib/social'
import { AppShell } from '@/components/app/app-shell'
import { TrackList } from '@/components/catalog/track-list'
import { PlayAllList } from '@/components/catalog/play-all'
import type { CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Classifiche — Selecta' }

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at, user_id, match_results'
const MONTH = 30 * 24 * 3.6e6

type Row = CatalogTrack & { published_at: string; user_id: string; match_results: { score?: number }[] | null }
const ready = (t: Row) => t.match_results?.[0]?.score ?? 0

export default async function ChartsPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket } = await searchParams
  const sb = createAdminClient()
  const [{ data }, { data: follows }] = await Promise.all([
    sb.from('user_submissions').select(SELECT).eq('published', true).limit(300),
    sb.from('follows').select('following_id').limit(5000),
  ])
  const all = (data ?? []) as Row[]
  const followers = new Map<string, number>()
  for (const f of (follows ?? []) as { following_id: string }[]) followers.set(f.following_id, (followers.get(f.following_id) ?? 0) + 1)

  if (bucket) {
    const list = all.filter((t) => t.sound_bucket === bucket).sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 50)
    const b = BUCKETS.find((x) => x.key === bucket)
    return (
      <AppShell>
        <header className="a-in mb-8">
          <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Classifica · sottogenere</p>
          <h1 className="mt-2 font-display display-tight text-5xl font-semibold tracking-tight text-text sm:text-6xl">Top {b?.label ?? ''}</h1>
          <div className="mt-6"><Chips active={bucket} /></div>
        </header>
        {list.length > 0 ? <PlayAllList tracks={list} label="Riproduci la Top" /> : <Empty />}
      </AppShell>
    )
  }

  const now = Date.now()
  const top = [...all].sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 50)
  const newHotPool = all.filter((t) => now - new Date(t.published_at).getTime() < MONTH)
  const newHot = (newHotPool.length >= 6 ? newHotPool : all).sort((a, b) => hotScore(b) - hotScore(a)).slice(0, 15)
  const emerging = [...all]
    .sort((a, b) => hotScore(b) / ((followers.get(b.user_id) ?? 0) + 1) - hotScore(a) / ((followers.get(a.user_id) ?? 0) + 1))
    .slice(0, 15)
  const labelReady = [...all].filter((t) => ready(t) > 0).sort((a, b) => ready(b) - ready(a)).slice(0, 15)
  const hiddenGems = [...all].filter((t) => ready(t) > 0).sort((a, b) => ready(b) / ((b.play_count ?? 0) + 5) - ready(a) / ((a.play_count ?? 0) + 5)).slice(0, 15)

  return (
    <AppShell>
      <header className="a-in mb-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">Ascolti · like · salvataggi reali</p>
            <h1 className="mt-2 font-display display-tight text-5xl font-semibold tracking-tight text-text sm:text-7xl">Classifiche</h1>
          </div>
          <p className="pb-1 text-right font-mono text-sm text-muted">
            <span className="text-2xl font-medium text-text">{all.length}</span> tracce in gara
          </p>
        </div>
        <p className="mt-3 max-w-xl text-muted">Cosa gira adesso nel catalogo. Niente numeri comprati.</p>
        <div className="mt-6"><Chips active={null} /></div>
      </header>

      {all.length === 0 ? <Empty /> : (
        <div className="space-y-14">
          <section>
            <H eyebrow="Engagement recente" title="Top della settimana" />
            <PlayAllList tracks={top} label="Riproduci la Top" />
          </section>
          <section>
            <H eyebrow="Uscite recenti in salita" title="New & Hot" />
            <TrackList tracks={newHot} />
          </section>
          <section>
            <H eyebrow="Pochi follower, tanta spinta" title="Emergenti" />
            <TrackList tracks={emerging} />
          </section>
          {labelReady.length > 0 && (
            <section>
              <H eyebrow="Il suono che le label firmano" title="Pronte da firmare" />
              <TrackList tracks={labelReady} />
            </section>
          )}
          {hiddenGems.length > 0 && (
            <section>
              <H eyebrow="Suono forte, pochi ascolti" title="Gemme nascoste" />
              <TrackList tracks={hiddenGems} />
            </section>
          )}
        </div>
      )}
    </AppShell>
  )
}

function Chips({ active }: { active: string | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/charts" className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!active ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'}`}>Tutto</Link>
      {BUCKETS.map((b) => (
        <Link key={b.key} href={`/charts?bucket=${b.key}`} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active === b.key ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'}`}>{b.label}</Link>
      ))}
    </div>
  )
}
function H({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="mb-5">
      <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-muted">{eyebrow}</p>
      <h2 className="mt-1 font-display display-tight text-3xl font-semibold tracking-tight text-text">{title}</h2>
    </div>
  )
}
function Empty() {
  return <div className="rounded-2xl glass border-dashed p-12 text-center text-muted">Ancora nessuna traccia in classifica.</div>
}
