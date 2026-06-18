import Link from 'next/link'
import type { Metadata } from 'next'
import { Heart, MessageCircle, Repeat2, UserPlus, LogIn, Bell, MessageSquare } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'
import { MarkRead } from '@/components/notifications/mark-read'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Notifiche — Selecta' }

interface Notif { id: string; actor_id: string | null; type: string; submission_id: string | null; created_at: string; read_at: string | null }

const VERB: Record<string, string> = { like: 'ha messo like a', comment: 'ha commentato', repost: 'ha repostato', follow: 'ha iniziato a seguirti', message: 'ti ha scritto' }
const ICON: Record<string, React.ReactNode> = {
  like: <Heart className="h-4 w-4 text-accent" />, comment: <MessageCircle className="h-4 w-4 text-accent" />,
  repost: <Repeat2 className="h-4 w-4 text-accent" />, follow: <UserPlus className="h-4 w-4 text-accent" />,
  message: <MessageSquare className="h-4 w-4 text-accent" />,
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'ora'; if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}g`
}

export default async function NotificationsPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <Bell className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Notifiche</h1>
          <p className="mt-2 text-muted">Accedi per vedere chi interagisce col tuo sound.</p>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }

  const sb = createAdminClient()
  const { data } = await sb.from('notifications').select('id, actor_id, type, submission_id, created_at, read_at').eq('recipient_id', user.id).order('created_at', { ascending: false }).limit(60)
  const notifs = (data ?? []) as Notif[]

  const actorIds = [...new Set(notifs.map((n) => n.actor_id).filter(Boolean))] as string[]
  const subIds = [...new Set(notifs.map((n) => n.submission_id).filter(Boolean))] as string[]
  const [{ data: actors }, { data: subs }] = await Promise.all([
    actorIds.length ? sb.from('artist_profiles').select('user_id, handle, display_name').in('user_id', actorIds) : Promise.resolve({ data: [] as unknown[] }),
    subIds.length ? sb.from('user_submissions').select('id, display_title').in('id', subIds) : Promise.resolve({ data: [] as unknown[] }),
  ])
  const actorMap = new Map((actors as { user_id: string; handle: string | null; display_name: string | null }[]).map((a) => [a.user_id, a]))
  const subMap = new Map((subs as { id: string; display_title: string | null }[]).map((s) => [s.id, s.display_title]))

  return (
    <AppShell>
      <MarkRead />
      <header className="mb-6">
        <h1 className="font-display text-4xl font-bold tracking-tight text-text">Notifiche</h1>
      </header>

      {notifs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted">Ancora nessuna notifica.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {notifs.map((n) => {
            const actor = n.actor_id ? actorMap.get(n.actor_id) : null
            const name = actor?.display_name || (actor?.handle ? `@${actor.handle}` : 'Qualcuno')
            const trackTitle = n.submission_id ? subMap.get(n.submission_id) : null
            const href = n.type === 'follow' ? (actor?.handle ? `/u/${actor.handle}` : '#') : n.type === 'message' ? (n.actor_id ? `/messages/${n.actor_id}` : '#') : n.submission_id ? `/catalog/${n.submission_id}` : '#'
            return (
              <Link key={n.id} href={href} className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface/60 ${n.read_at ? '' : 'bg-accent/[0.03]'}`}>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-2">{ICON[n.type]}</span>
                <p className="min-w-0 flex-1 text-sm text-text">
                  <span className="font-semibold">{name}</span> <span className="text-muted">{VERB[n.type] ?? 'ha interagito'}</span>
                  {trackTitle && <span className="font-medium"> {trackTitle}</span>}
                </p>
                <span className="shrink-0 text-xs text-faint">{timeAgo(n.created_at)}</span>
              </Link>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
