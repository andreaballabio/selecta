import Link from 'next/link'
import type { Metadata } from 'next'
import { Trophy, Flame, Rocket, BadgeCheck, Gem } from 'lucide-react'
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
        <Chips active={bucket} />
        <header className="mb-6"><h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text">Top {b?.label ?? ''}</h1></header>
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
      <Chips active={null} />
      <header className="mb-8">
        <h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text sm:text-5xl">Classifiche</h1>
        <p className="mt-2 max-w-xl text-muted">Cosa gira adesso nel catalogo, su ascolti, like e salvataggi reali.</p>
      </header>

      {all.length === 0 ? <Empty /> : (
        <div className="space-y-12">
          <section>
            <H icon={<Trophy className="h-5 w-5 text-accent" />} title="Top della settimana" sub="Le più forti su engagement recente" />
            <PlayAllList tracks={top} label="Riproduci la Top" />
          </section>
          <section>
            <H icon={<Flame className="h-5 w-5 text-accent" />} title="New & Hot" sub="Uscite recenti in salita" />
            <TrackList tracks={newHot} />
          </section>
          <section>
            <H icon={<Rocket className="h-5 w-5 text-accent" />} title="Emergenti" sub="Talenti con pochi follower che stanno spingendo" />
            <TrackList tracks={emerging} />
          </section>
          {labelReady.length > 0 && (
            <section>
              <H icon={<BadgeCheck className="h-5 w-5 text-accent" />} title="Pronte da firmare" sub="Il sound più vicino a quello che le label firmano" />
              <TrackList tracks={labelReady} />
            </section>
          )}
          {hiddenGems.length > 0 && (
            <section>
              <H icon={<Gem className="h-5 w-5 text-accent" />} title="Gemme nascoste" sub="Suono forte ma ancora pochi ascolti" />
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
    <div className="mb-7 flex flex-wrap gap-2">
      <Link href="/charts" className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${!active ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'}`}>Tutto</Link>
      {BUCKETS.map((b) => (
        <Link key={b.key} href={`/charts?bucket=${b.key}`} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active === b.key ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'}`}>{b.label}</Link>
      ))}
    </div>
  )
}
function H({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-text">{icon}{title}</h2>
      <p className="mt-1 text-sm text-muted">{sub}</p>
    </div>
  )
}
function Empty() {
  return <div className="rounded-2xl glass border-dashed p-12 text-center text-muted">Ancora nessuna traccia in classifica.</div>
}
