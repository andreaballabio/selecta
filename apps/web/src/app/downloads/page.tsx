import Link from 'next/link'
import type { Metadata } from 'next'
import { Download, LogIn } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { AppShell } from '@/components/app/app-shell'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Download — Selecta' }

interface D { id: string; submission_id: string | null; label: string | null; created_at: string }

export default async function DownloadsPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <Download className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Download</h1>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }
  const sb = createAdminClient()
  const { data } = await sb.from('downloads').select('id, submission_id, label, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
  const rows = (data ?? []) as D[]
  const subIds = [...new Set(rows.map((r) => r.submission_id).filter(Boolean))] as string[]
  const { data: subs } = subIds.length ? await sb.from('user_submissions').select('id, display_title, display_artist').in('id', subIds) : { data: [] as unknown[] }
  const tm = new Map((subs as { id: string; display_title: string | null; display_artist: string | null }[]).map((s) => [s.id, s]))

  return (
    <AppShell>
      <header className="mb-6"><h1 className="font-display text-4xl font-bold tracking-tight text-text">Download</h1></header>
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted">
          Nessun download. Serve il <Link href="/pricing" className="text-accent hover:underline">DJ Pool</Link>.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line">
          {rows.map((r) => {
            const t = r.submission_id ? tm.get(r.submission_id) : null
            const title = t ? `${t.display_artist ? t.display_artist + ' — ' : ''}${t.display_title}` : 'Traccia'
            return (
              <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-0">
                <Download className="h-4 w-4 shrink-0 text-faint" />
                {r.submission_id ? <Link href={`/catalog/${r.submission_id}`} className="min-w-0 flex-1 truncate text-sm text-text hover:text-accent">{title}{r.label ? ` (${r.label})` : ''}</Link> : <span className="min-w-0 flex-1 truncate text-sm text-muted">{title}</span>}
                <span className="shrink-0 text-xs text-faint">{new Date(r.created_at).toLocaleDateString('it-IT')}</span>
              </div>
            )
          })}
        </div>
      )}
    </AppShell>
  )
}
