import Link from 'next/link'
import { Flag } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReportActions } from '@/components/admin/report-actions'

export const dynamic = 'force-dynamic'

interface R { id: string; submission_id: string; reason: string; details: string | null; created_at: string }

export default async function AdminReports() {
  const sb = createAdminClient()
  const { data } = await sb.from('track_reports').select('id, submission_id, reason, details, created_at').eq('resolved', false).order('created_at', { ascending: false }).limit(100)
  const reports = (data ?? []) as R[]
  const subIds = [...new Set(reports.map((r) => r.submission_id))]
  const { data: subs } = subIds.length ? await sb.from('user_submissions').select('id, display_title, display_artist').in('id', subIds) : { data: [] as unknown[] }
  const tm = new Map((subs as { id: string; display_title: string | null; display_artist: string | null }[]).map((s) => [s.id, s]))

  return (
    <div>
      <h1 className="mb-6 font-display text-3xl font-bold text-text">Segnalazioni</h1>
      {reports.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-12 text-center text-muted"><Flag className="mx-auto mb-3 h-6 w-6 text-faint" /> Nessuna segnalazione aperta.</div>
      ) : (
        <div className="space-y-3">
          {reports.map((r) => {
            const t = tm.get(r.submission_id)
            return (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface/50 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-text">
                    <Link href={`/catalog/${r.submission_id}`} className="hover:text-accent">{t ? `${t.display_artist ? t.display_artist + ' — ' : ''}${t.display_title}` : 'Traccia'}</Link>
                    <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold capitalize text-red-400">{r.reason}</span>
                  </p>
                  {r.details && <p className="mt-1 text-sm text-muted">{r.details}</p>}
                  <p className="mt-0.5 text-xs text-faint">{new Date(r.created_at).toLocaleString('it-IT')}</p>
                </div>
                <ReportActions reportId={r.id} submissionId={r.submission_id} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
