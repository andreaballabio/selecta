import Link from 'next/link'
import type { Metadata } from 'next'
import { Disc3, Flame, Clock, ArrowRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKETS } from '@/lib/sound-bucket'
import { hotScore } from '@/lib/social'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { FeaturedTrack } from '@/components/catalog/featured-track'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Library — Selecta',
  description: 'Tech House non firmata, curata per come suona. Ascolta le tendenze, scopri per sottogenere, trova il prossimo sound.',
}

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ bucket?: string }> }) {
  const { bucket } = await searchParams
  const sb = createAdminClient()
  const { data } = await sb.from('user_submissions').select(SELECT).eq('published', true).limit(120)
  const all = (data ?? []) as (CatalogTrack & { published_at: string })[]

  const trending = [...all].sort((a, b) => hotScore(b) - hotScore(a))
  const recent = [...all].sort((a, b) => (b.published_at ?? '').localeCompare(a.published_at ?? ''))
  const featured = trending[0]

  // Filtro per bucket
  if (bucket) {
    const list = trending.filter((t) => t.sound_bucket === bucket)
    const b = BUCKETS.find((x) => x.key === bucket)
    return (
      <Shell active={bucket}>
        <header className="mb-8">
          <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">{b?.label ?? 'Sottogenere'}</h1>
          {b && <p className="mt-2 text-muted">{b.blurb}</p>}
        </header>
        <CatalogGrid tracks={list} />
      </Shell>
    )
  }

  return (
    <Shell active={null}>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">Library</h1>
        <p className="mt-2 max-w-xl text-muted">Tech House non firmata, curata dall’AI per come suona. Ascolta, salva, scopri il prossimo sound.</p>
      </header>

      {all.length === 0 ? (
        <CatalogGrid tracks={[]} />
      ) : (
        <div className="space-y-14">
          {featured && <FeaturedTrack track={featured} />}

          <Section icon={<Flame className="h-5 w-5 text-accent" />} title="In tendenza" href="/charts">
            <CatalogGrid tracks={trending.slice(0, 8)} />
          </Section>

          <Section icon={<Clock className="h-5 w-5 text-accent" />} title="Nuove uscite">
            <CatalogGrid tracks={recent.slice(0, 8)} />
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
    </Shell>
  )
}

function Shell({ children, active }: { children: React.ReactNode; active: string | null }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
        {/* Chips sottogeneri */}
        <div className="mb-8 flex flex-wrap gap-2">
          <Chip href="/library" active={active === null}>Tutto</Chip>
          {BUCKETS.map((b) => (
            <Chip key={b.key} href={`/library?bucket=${b.key}`} active={active === b.key}>{b.label}</Chip>
          ))}
        </div>
        {children}
      </div>
    </div>
  )
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active ? 'bg-accent text-accent-ink' : 'border border-line text-muted hover:text-text'
      }`}
    >
      {children}
    </Link>
  )
}

function Section({ icon, title, sub, href, children }: { icon: React.ReactNode; title: string; sub?: string; href?: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-2xl font-bold text-text">{icon}{title}</h2>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
            Vedi tutto <ArrowRight className="h-4 w-4" />
          </Link>
        )}
      </div>
      {children}
    </section>
  )
}
