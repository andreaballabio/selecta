import Link from 'next/link'
import { ExternalLink, ChevronLeft, ChevronRight } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
const PER = 50

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, Number(pageStr) || 1)
  const sb = createAdminClient()

  const { data: list } = await sb.auth.admin.listUsers({ page, perPage: PER })
  const users = list?.users ?? []
  const ids = users.map((u) => u.id)

  const [{ data: profs }, { data: subsRows }, { data: subscriptions }] = await Promise.all([
    ids.length ? sb.from('artist_profiles').select('user_id, handle, display_name').in('user_id', ids) : Promise.resolve({ data: [] as unknown[] }),
    ids.length ? sb.from('user_submissions').select('user_id, published').in('user_id', ids) : Promise.resolve({ data: [] as unknown[] }),
    ids.length ? sb.from('subscriptions').select('user_id, tier, status').in('user_id', ids) : Promise.resolve({ data: [] as unknown[] }),
  ])
  const pm = new Map((profs as { user_id: string; handle: string | null; display_name: string | null }[]).map((p) => [p.user_id, p]))
  const subCount = new Map<string, { total: number; pub: number }>()
  for (const r of (subsRows as { user_id: string; published: boolean | null }[])) {
    const c = subCount.get(r.user_id) ?? { total: 0, pub: 0 }
    c.total++; if (r.published) c.pub++
    subCount.set(r.user_id, c)
  }
  const subMap = new Map((subscriptions as { user_id: string; tier: string; status: string }[]).map((s) => [s.user_id, s]))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-3xl font-bold text-text">Utenti</h1>
        <span className="text-sm text-muted">Pagina {page}</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <div className="hidden grid-cols-[1fr_auto_auto_auto_auto] gap-4 border-b border-line bg-surface/60 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-faint sm:grid">
          <span>Utente</span><span>Analisi</span><span>Pubbl.</span><span>Piano</span><span>Registrato</span>
        </div>
        {users.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">Nessun utente in questa pagina.</p>
        ) : users.map((u) => {
          const p = pm.get(u.id)
          const c = subCount.get(u.id) ?? { total: 0, pub: 0 }
          const sub = subMap.get(u.id)
          return (
            <div key={u.id} className="grid grid-cols-2 items-center gap-2 border-b border-line px-4 py-3 last:border-0 sm:grid-cols-[1fr_auto_auto_auto_auto] sm:gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text">{p?.display_name || u.email}</p>
                <p className="truncate text-xs text-muted">
                  {u.email}
                  {p?.handle && <> · <Link href={`/u/${p.handle}`} className="text-accent hover:underline">@{p.handle} <ExternalLink className="inline h-3 w-3" /></Link></>}
                </p>
              </div>
              <span className="text-sm tabular-nums text-muted">{c.total}</span>
              <span className="text-sm tabular-nums text-muted">{c.pub}</span>
              <span className="text-xs">{sub?.status === 'active' ? <span className="rounded-full bg-accent/15 px-2 py-0.5 font-semibold text-accent">{sub.tier}</span> : <span className="text-faint">free</span>}</span>
              <span className="text-xs text-faint">{u.created_at ? new Date(u.created_at).toLocaleDateString('it-IT') : ''}</span>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        {page > 1 ? <Link href={`/admin/users?page=${page - 1}`} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-text hover:border-faint"><ChevronLeft className="h-4 w-4" /> Prec.</Link> : <span />}
        {users.length === PER ? <Link href={`/admin/users?page=${page + 1}`} className="flex items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm text-text hover:border-faint">Succ. <ChevronRight className="h-4 w-4" /></Link> : <span />}
      </div>
    </div>
  )
}
