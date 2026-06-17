import Link from 'next/link'
import type { Metadata } from 'next'
import { TrendingUp, Heart, Bookmark, Play } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { BUCKETS, bucketByKey } from '@/lib/sound-bucket'
import { hotScore } from '@/lib/social'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Classifiche — Selecta',
  description: 'Le tracce di Tech House non firmata che stanno girando: più ascoltate, amate e salvate dai DJ.',
}

interface Row {
  id: string
  display_title: string | null
  display_artist: string | null
  sound_bucket: string | null
  likes_count: number | null
  saves_count: number | null
  play_count: number | null
  published_at: string | null
}

export default async function ChartsPage() {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_submissions')
    .select('id, display_title, display_artist, sound_bucket, likes_count, saves_count, play_count, published_at')
    .eq('published', true)
    .limit(300)

  const rows = (data ?? []) as Row[]
  const ranked = [...rows].sort((a, b) => hotScore(b) - hotScore(a))
  const top = ranked.slice(0, 20)

  const perBucket = BUCKETS.map((b) => ({
    bucket: b,
    tracks: ranked.filter((r) => r.sound_bucket === b.key).slice(0, 3),
  })).filter((g) => g.tracks.length > 0)

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Classifiche</span>
          </div>
          <h1 className="text-3xl font-bold text-white">Cosa sta girando</h1>
          <p className="mt-2 text-zinc-400">Ranking per ascolti, like e salvataggi dei DJ — con peso al più recente.</p>
        </header>

        {top.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/40 p-10 text-center text-zinc-500">
            Ancora nessuna traccia in classifica. <Link href="/match" className="text-emerald-400 hover:underline">Pubblica la prima.</Link>
          </div>
        ) : (
          <>
            <section className="mb-10">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">In tendenza ora</h2>
              <div className="divide-y divide-zinc-900 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
                {top.map((t, i) => (
                  <ChartRow key={t.id} row={t} pos={i + 1} />
                ))}
              </div>
            </section>

            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Sound del mese</h2>
              <div className="space-y-6">
                {perBucket.map(({ bucket, tracks }) => (
                  <div key={bucket.key}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <h3 className="font-semibold text-emerald-400">{bucket.label}</h3>
                      <Link href={`/catalog?bucket=${bucket.key}`} className="text-xs text-zinc-500 hover:text-white">Vedi tutto →</Link>
                    </div>
                    <div className="divide-y divide-zinc-900 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/50">
                      {tracks.map((t, i) => <ChartRow key={t.id} row={t} pos={i + 1} />)}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </div>
  )
}

function ChartRow({ row, pos }: { row: Row; pos: number }) {
  const bucket = bucketByKey(row.sound_bucket)
  return (
    <Link href={`/catalog/${row.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-900/50">
      <span className={`w-6 shrink-0 text-center text-sm font-bold ${pos <= 3 ? 'text-emerald-400' : 'text-zinc-600'}`}>{pos}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-white">{row.display_title || 'Senza titolo'}</p>
        <p className="truncate text-xs text-zinc-500">
          {row.display_artist || 'Sconosciuto'}{bucket ? ` · ${bucket.label}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1"><Play className="h-3.5 w-3.5" />{row.play_count ?? 0}</span>
        <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{row.likes_count ?? 0}</span>
        <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{row.saves_count ?? 0}</span>
      </div>
    </Link>
  )
}
