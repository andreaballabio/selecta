import Link from 'next/link'
import type { Metadata } from 'next'
import { Play, Heart, Bookmark, Repeat2, MessageCircle, LogIn, BarChart3 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Insights — Selecta' }

interface T { id: string; display_title: string | null; play_count: number | null; likes_count: number | null; saves_count: number | null; reposts_count: number | null; comments_count: number | null }

export default async function InsightsPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <BarChart3 className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Insights</h1>
          <p className="mt-2 text-muted">Accedi per vedere come performano le tue tracce.</p>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }

  const sb = createAdminClient()
  const { data: trackRows } = await sb.from('user_submissions')
    .select('id, display_title, play_count, likes_count, saves_count, reposts_count, comments_count')
    .eq('user_id', user.id).eq('published', true).order('play_count', { ascending: false }).limit(100)
  const tracks = (trackRows ?? []) as T[]
  const sum = (k: keyof T) => tracks.reduce((s, t) => s + ((t[k] as number) ?? 0), 0)
  const totals = { plays: sum('play_count'), likes: sum('likes_count'), saves: sum('saves_count'), reposts: sum('reposts_count'), comments: sum('comments_count') }

  // Top supporter: chi mette like/salva le tue tracce (save pesa di più)
  const ids = tracks.map((t) => t.id)
  let supporters: { handle: string | null; name: string | null; score: number }[] = []
  if (ids.length) {
    const [{ data: likes }, { data: saves }] = await Promise.all([
      sb.from('track_likes').select('user_id').in('submission_id', ids).limit(2000),
      sb.from('track_saves').select('user_id').in('submission_id', ids).limit(2000),
    ])
    const score = new Map<string, number>()
    for (const r of (likes ?? []) as { user_id: string }[]) if (r.user_id !== user.id) score.set(r.user_id, (score.get(r.user_id) ?? 0) + 1)
    for (const r of (saves ?? []) as { user_id: string }[]) if (r.user_id !== user.id) score.set(r.user_id, (score.get(r.user_id) ?? 0) + 2)
    const topIds = [...score.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
    if (topIds.length) {
      const { data: profs } = await sb.from('artist_profiles').select('user_id, handle, display_name').in('user_id', topIds.map(([id]) => id))
      const pm = new Map((profs as { user_id: string; handle: string | null; display_name: string | null }[]).map((p) => [p.user_id, p]))
      supporters = topIds.map(([id, s]) => ({ handle: pm.get(id)?.handle ?? null, name: pm.get(id)?.display_name ?? null, score: s }))
    }
  }

  const STAT = [
    { label: 'Ascolti', value: totals.plays, icon: Play },
    { label: 'Like', value: totals.likes, icon: Heart },
    { label: 'Salvataggi', value: totals.saves, icon: Bookmark },
    { label: 'Repost', value: totals.reposts, icon: Repeat2 },
    { label: 'Commenti', value: totals.comments, icon: MessageCircle },
  ]

  return (
    <AppShell>
      <header className="mb-8">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">Insights</h1>
        <p className="mt-2 text-muted">Come performano le tue {tracks.length} tracce pubblicate.</p>
      </header>

      <div className="mb-10 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-5">
        {STAT.map((s) => (
          <div key={s.label} className="bg-surface/60 p-4 text-center">
            <s.icon className="mx-auto mb-1.5 h-4 w-4 text-accent" />
            <p className="font-display text-2xl font-bold text-text tabular-nums">{s.value.toLocaleString('it-IT')}</p>
            <p className="text-xs text-muted">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_18rem]">
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Per traccia</h2>
          {tracks.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-10 text-center text-muted">Nessuna traccia pubblicata.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              {tracks.map((t) => (
                <Link key={t.id} href={`/catalog/${t.id}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface/60">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-text">{t.display_title || 'Senza titolo'}</span>
                  <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1"><Play className="h-3.5 w-3.5" />{t.play_count ?? 0}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{t.likes_count ?? 0}</span>
                    <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{t.saves_count ?? 0}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">Top supporter</h2>
          {supporters.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-6 text-center text-sm text-muted">Ancora nessuno.</div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-line">
              {supporters.map((s, i) => (
                <div key={i} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-0">
                  <span className="w-4 text-sm tabular-nums text-faint">{i + 1}</span>
                  {s.handle ? <Link href={`/u/${s.handle}`} className="min-w-0 flex-1 truncate text-sm text-text hover:text-accent">{s.name || `@${s.handle}`}</Link> : <span className="min-w-0 flex-1 truncate text-sm text-muted">{s.name || 'Utente'}</span>}
                  <span className="text-xs text-faint">{s.score}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  )
}
