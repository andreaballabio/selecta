import Link from 'next/link'
import type { Metadata } from 'next'
import { Disc3, Flame, Clock, ArrowRight, Sparkles } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { BUCKETS } from '@/lib/sound-bucket'
import { hotScore } from '@/lib/social'
import { getMixForUser } from '@/lib/mix'
import { AppShell } from '@/components/app/app-shell'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { TrackList } from '@/components/catalog/track-list'
import { FeaturedTrack } from '@/components/catalog/featured-track'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Library — Selecta',
  description: 'Tech House non firmata, curata per come suona. Tendenze, nuove uscite, sottogeneri.',
}

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket } = await searchParams
  const sb = createAdminClient()
  const { data } = await sb.from('user_submissions').select(SELECT).eq('published', true).limit(150)
  const all = (data ?? []) as (CatalogTrack & { published_at: string })[]
  const trending = [...all].sort((a, b) => hotScore(b) - hotScore(a))
  const recent = [...all].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const featured = trending[0]

  // "Per te" — solo per utenti loggati con gusto (like/salvataggi)
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  const mix = !bucket && user ? (await getMixForUser(user.id, 8)).tracks : []

  return (
    <AppShell>
      {/* chips sottogeneri */}
      <div className="mb-7 flex flex-wrap gap-2">
        <Chip href="/library" active={!bucket}>Tutto</Chip>
        {BUCKETS.map((b) => <Chip key={b.key} href={`/library?bucket=${b.key}`} active={bucket === b.key}>{b.label}</Chip>)}
      </div>

      {bucket ? (
        (() => {
          const list = trending.filter((t) => t.sound_bucket === bucket)
          const b = BUCKETS.find((x) => x.key === bucket)
          return (
            <>
              <header className="mb-6">
                <h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text">{b?.label ?? 'Sottogenere'}</h1>
                {b && <p className="mt-2 text-muted">{b.blurb}</p>}
              </header>
              {list.length > 0 ? <TrackList tracks={list} numbered /> : <CatalogGrid tracks={[]} />}
            </>
          )
        })()
      ) : all.length === 0 ? (
        <>
          <h1 className="mb-6 font-display display-tight text-4xl font-semibold tracking-tight text-text">Library</h1>
          <CatalogGrid tracks={[]} />
        </>
      ) : (
        <div className="space-y-12">
          <header>
            <h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text">Library</h1>
            <p className="mt-2 max-w-xl text-muted">Tech House non firmata, curata dall’AI per come suona.</p>
          </header>

          {mix.length > 0 && (
            <Section icon={<Sparkles className="h-5 w-5 text-accent" />} title="Per te" href="/mix" sub="Sul tuo gusto, dai like e dai salvataggi">
              <CatalogGrid tracks={mix} />
            </Section>
          )}

          {featured && <FeaturedTrack track={featured} />}

          <Section icon={<Flame className="h-5 w-5 text-accent" />} title="In tendenza" href="/charts">
            <TrackList tracks={trending.slice(0, 10)} numbered />
          </Section>

          <Section icon={<Clock className="h-5 w-5 text-accent" />} title="Nuove uscite">
            <TrackList tracks={recent.slice(0, 8)} />
          </Section>

          {BUCKETS.map((b) => {
            const list = trending.filter((t) => t.sound_bucket === b.key).slice(0, 4)
            if (list.length === 0) return null
            return (
              <Section key={b.key} icon={<Disc3 className="h-5 w-5 text-accent" />} title={b.label} href={`/library?bucket=${b.key}`} sub={b.blurb}>
                <CatalogGrid tracks={list} />
              </Section>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${active ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'}`}>
      {children}
    </Link>
  )
}

function Section({ icon, title, sub, href, children }: { icon: React.ReactNode; title: string; sub?: string; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-text">{icon}{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
        {href && <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">Vedi tutto <ArrowRight className="h-4 w-4" /></Link>}
      </div>
      {children}
    </section>
  )
}
