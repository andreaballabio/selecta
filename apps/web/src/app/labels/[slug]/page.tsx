import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, CheckCircle2, ExternalLink, Upload, Send } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchLabelDetail, type LabelRow } from '@/lib/labels'
import { AppShell } from '@/components/app/app-shell'
import { LabelTracks } from '@/components/labels/label-tracks'
import { difficultyMeta, toneClass, featureBars, soundTags, relativeDate } from '@/lib/label-display'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const sb = createAdminClient()
  const d = (await fetchLabelDetail(sb, { slug })) ?? (await fetchLabelDetail(sb, { id: slug }))
  return { title: d ? `${d.label.name} — Selecta` : 'Label — Selecta' }
}

const href = (u?: string | null) => (!u ? null : u.startsWith('http') ? u : `https://${u}`)

function reachReasons(l: LabelRow): string[] {
  const r: string[] = []
  if (l.openness_score != null) r.push(l.openness_score >= 60 ? 'firma spesso gente nuova' : l.openness_score >= 35 ? 'mix di nomi noti e nuovi' : 'firma soprattutto i suoi artisti')
  if (l.release_cadence_12mo != null) r.push(l.release_cadence_12mo >= 24 ? 'molto attiva' : l.release_cadence_12mo >= 8 ? 'attiva' : 'poche uscite recenti')
  if ((l.cataloged_tracks ?? 0) >= 300) r.push('catalogo grande/affermato')
  return r
}

export default async function LabelDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const sb = createAdminClient()
  const detail = (await fetchLabelDetail(sb, { slug })) ?? (await fetchLabelDetail(sb, { id: slug }))
  if (!detail) notFound()

  const { label: l, profile, tracks } = detail
  const dm = difficultyMeta(l.reachability_score)
  const bars = featureBars(profile)
  const tags = soundTags(profile)
  const reasons = reachReasons(l)
  const submitUrl = href(l.demo_submission_url)
  const siteUrl = href(l.website_url)

  return (
    <AppShell>
      <div className="space-y-6">
        <Link href="/labels" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Tutte le label</Link>

        {/* Header */}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">{l.name}</h1>
            <p className="mt-1 text-muted">{l.primary_genre || '—'} · {l.cataloged_tracks ?? 0} tracce · ultima uscita {relativeDate(l.last_release_date)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClass[dm.tone]}`}>{dm.label}</span>
              {l.accepts_unsolicited_demos && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> accetta demo</span>}
              {tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs text-muted">{t}</span>)}
            </div>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Sound DNA */}
          <section className="rounded-2xl glass p-5 lg:col-span-2">
            <h2 className="mb-4 font-display text-lg font-bold text-text">Il sound della label</h2>
            {bars.length === 0 ? (
              <p className="text-sm text-muted">Profilo sonoro non ancora disponibile (label in analisi).</p>
            ) : (
              <div className="space-y-3">
                {bars.map((b) => (
                  <div key={b.label} className="flex items-center gap-3">
                    <span className="w-28 shrink-0 text-sm text-muted">{b.label}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${b.pct}%` }} />
                    </div>
                    <span className="w-8 shrink-0 text-right text-xs text-faint">{b.pct}</span>
                  </div>
                ))}
              </div>
            )}
            {(l.reference_artists?.length ?? 0) > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Artisti di punta</p>
                <div className="flex flex-wrap gap-1.5">
                  {l.reference_artists!.map((a: string) => <span key={a} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-text">{a}</span>)}
                </div>
              </div>
            )}
          </section>

          {/* Reachability + invio */}
          <div className="space-y-6">
            <section className="rounded-2xl glass p-5">
              <h2 className="mb-3 font-display text-lg font-bold text-text">Quanto è raggiungibile</h2>
              {l.reachability_score == null ? (
                <p className="text-sm text-muted">In calcolo (serve l'analisi del catalogo).</p>
              ) : (
                <>
                  <div className="mb-2 flex items-end justify-between">
                    <span className={`text-3xl font-bold ${dm.tone === 'accent' ? 'text-accent' : dm.tone === 'yellow' ? 'text-yellow-400' : 'text-red-400'}`}>{dm.label}</span>
                    <span className="text-xs text-muted">{l.reachability_score}/100</span>
                  </div>
                  <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
                    <div className={`h-full rounded-full ${dm.tone === 'accent' ? 'bg-accent' : dm.tone === 'yellow' ? 'bg-yellow-400' : 'bg-red-400'}`} style={{ width: `${l.reachability_score}%` }} />
                  </div>
                  <ul className="space-y-1 text-sm text-muted">
                    {reasons.map((r) => <li key={r} className="flex gap-2"><span className="text-faint">—</span>{r}</li>)}
                  </ul>
                  <div className="mt-3 flex gap-4 text-xs text-faint">
                    {l.openness_score != null && <span>apertura {l.openness_score}/100</span>}
                    {l.release_cadence_12mo != null && <span>{l.release_cadence_12mo} uscite / 12 mesi</span>}
                  </div>
                </>
              )}
            </section>

            <section className="rounded-2xl glass p-5">
              <h2 className="mb-3 font-display text-lg font-bold text-text">Mandare la demo</h2>
              {l.accepts_unsolicited_demos === false ? (
                <p className="text-sm text-muted">Questa label firma <strong className="text-text">su invito</strong> / contatti diretti.</p>
              ) : submitUrl ? (
                <a href={submitUrl} target="_blank" rel="noreferrer" className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-accent-ink">
                  <Send className="h-4 w-4" /> Manda la demo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : (
                <p className="text-sm text-muted">Canale d'invio non ancora mappato. {siteUrl && <a href={siteUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">Sito della label →</a>}</p>
              )}
              <p className="mt-3 text-[11px] text-faint">Verifica sempre il canale ufficiale prima di inviare.</p>
              <Link href="/match" className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted hover:text-text"><Upload className="h-3.5 w-3.5" /> Il TUO suono calza? Carica la traccia per il match vero</Link>
            </section>
          </div>
        </div>

        {/* Ultime uscite */}
        <section>
          <h2 className="mb-3 font-display text-lg font-bold text-text">Ultime uscite</h2>
          <LabelTracks tracks={tracks as any} />
        </section>
      </div>
    </AppShell>
  )
}
