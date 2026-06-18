import Link from 'next/link'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, LogIn } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'
import { MessageThread } from '@/components/messages/message-thread'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Conversazione — Selecta' }

export default async function ThreadPage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <h1 className="font-display text-3xl font-bold text-text">Messaggi</h1>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }
  if (userId === user.id) redirect('/messages')

  const sb = createAdminClient()
  const { data: p } = await sb.from('artist_profiles').select('handle, display_name, photo_url').eq('user_id', userId).maybeSingle()
  const prof = p as { handle: string | null; display_name: string | null; photo_url: string | null } | null
  const name = prof?.display_name || (prof?.handle ? `@${prof.handle}` : 'Artista')
  const initials = name.replace('@', '').slice(0, 2).toUpperCase()

  return (
    <AppShell>
      <Link href="/messages" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Messaggi</Link>
      <div className="mb-4 flex items-center gap-3">
        <div className="h-11 w-11 overflow-hidden rounded-full bg-surface-2">
          {prof?.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={prof.photo_url} alt="" className="h-full w-full object-cover" />
            : <div className="flex h-full w-full items-center justify-center text-xs font-bold text-faint">{initials}</div>}
        </div>
        <div>
          <p className="font-display text-lg font-bold text-text">{name}</p>
          {prof?.handle && <Link href={`/u/${prof.handle}`} className="text-sm text-muted hover:text-accent">Profilo</Link>}
        </div>
      </div>
      <MessageThread meId={user.id} otherId={userId} />
    </AppShell>
  )
}
