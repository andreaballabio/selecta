import Link from 'next/link'
import { Users, Disc, Music, BarChart3, CreditCard, Download, Radio, MessageSquare } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

async function count(sb: ReturnType<typeof createAdminClient>, table: string, build?: (q: any) => any) {
  let q = sb.from(table).select('*', { count: 'exact', head: true })
  if (build) q = build(q)
  const { count } = await q
  return count ?? 0
}

export default async function AdminDashboard() {
  const sb = createAdminClient()
  const [profiles, published, analyzed, labels, activeSubs, downloads, playlists, messages] = await Promise.all([
    count(sb, 'artist_profiles'),
    count(sb, 'user_submissions', (q) => q.eq('published', true)),
    count(sb, 'user_submissions', (q) => q.eq('analysis_status', 'analyzed')),
    count(sb, 'labels'),
    count(sb, 'subscriptions', (q) => q.eq('status', 'active')),
    count(sb, 'downloads'),
    count(sb, 'playlists'),
    count(sb, 'messages'),
  ])

  const STAT = [
    { label: 'Profili artista', value: profiles, icon: Users, href: '/admin/users' },
    { label: 'Tracce pubblicate', value: published, icon: Radio, href: '/library' },
    { label: 'Analisi totali', value: analyzed, icon: Music },
    { label: 'Label', value: labels, icon: Disc, href: '/admin/labels' },
    { label: 'Abbonamenti attivi', value: activeSubs, icon: CreditCard },
    { label: 'Download', value: downloads, icon: Download },
    { label: 'Playlist', value: playlists, icon: BarChart3 },
    { label: 'Messaggi', value: messages, icon: MessageSquare },
  ]

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold text-text">Dashboard</h1>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {STAT.map((s) => {
          const card = (
            <div className="rounded-2xl border border-line bg-surface/50 p-5 transition-colors hover:border-faint">
              <s.icon className="mb-3 h-5 w-5 text-accent" />
              <p className="font-display text-3xl font-bold text-text tabular-nums">{s.value.toLocaleString('it-IT')}</p>
              <p className="mt-0.5 text-sm text-muted">{s.label}</p>
            </div>
          )
          return s.href ? <Link key={s.label} href={s.href}>{card}</Link> : <div key={s.label}>{card}</div>
        })}
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/admin/users" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 p-5 hover:border-faint">
          <Users className="h-6 w-6 text-accent" />
          <div><p className="font-semibold text-text">Gestione utenti</p><p className="text-sm text-muted">Cerca, ispeziona, modera</p></div>
        </Link>
        <Link href="/admin/labels" className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 p-5 hover:border-faint">
          <Disc className="h-6 w-6 text-accent" />
          <div><p className="font-semibold text-text">Gestione label</p><p className="text-sm text-muted">Catalogo, tracce, profili sonori</p></div>
        </Link>
      </div>
    </div>
  )
}
