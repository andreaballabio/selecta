import Link from 'next/link'
import type { Metadata } from 'next'
import { MessageSquare, LogIn } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Messaggi — Selecta' }

interface Msg { id: string; sender_id: string; recipient_id: string; body: string; created_at: string; read_at: string | null }

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'ora'; if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}g`
}

export default async function MessagesPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <MessageSquare className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Messaggi</h1>
          <p className="mt-2 text-muted">Accedi per scrivere ad artisti, DJ e label.</p>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }

  const sb = createAdminClient()
  const { data } = await sb.from('messages')
    .select('id, sender_id, recipient_id, body, created_at, read_at')
    .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
    .order('created_at', { ascending: false }).limit(300)
  const msgs = (data ?? []) as Msg[]

  // Raggruppa per interlocutore (ultimo messaggio + non-letti)
  const convs = new Map<string, { last: Msg; unread: number }>()
  for (const m of msgs) {
    const other = m.sender_id === user.id ? m.recipient_id : m.sender_id
    const c = convs.get(other)
    const isUnread = m.recipient_id === user.id && !m.read_at
    if (!c) convs.set(other, { last: m, unread: isUnread ? 1 : 0 })
    else if (isUnread) c.unread += 1
  }
  const otherIds = [...convs.keys()]
  const { data: profs } = otherIds.length
    ? await sb.from('artist_profiles').select('user_id, handle, display_name, photo_url').in('user_id', otherIds)
    : { data: [] as unknown[] }
  const profMap = new Map((profs as { user_id: string; handle: string | null; display_name: string | null; photo_url: string | null }[]).map((p) => [p.user_id, p]))

  return (
    <AppShell>
      <header className="mb-6"><h1 className="font-display text-4xl font-bold tracking-tight text-text">Messaggi</h1></header>
      {otherIds.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted">
          Nessuna conversazione. Apri il profilo di un artista e scrivigli.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {otherIds.map((oid) => {
            const { last, unread } = convs.get(oid)!
            const p = profMap.get(oid)
            const name = p?.display_name || (p?.handle ? `@${p.handle}` : 'Artista')
            const initials = name.replace('@', '').slice(0, 2).toUpperCase()
            return (
              <Link key={oid} href={`/messages/${oid}`} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0 hover:bg-surface/60">
                <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full bg-surface-2">
                  {p?.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.photo_url} alt="" className="h-full w-full object-cover" />
                    : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-faint">{initials}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-text">{name}</p>
                  <p className="truncate text-sm text-muted">{last.sender_id === user.id ? 'Tu: ' : ''}{last.body}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-faint">{timeAgo(last.created_at)}</span>
                  {unread > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-bold text-accent-ink">{unread}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
