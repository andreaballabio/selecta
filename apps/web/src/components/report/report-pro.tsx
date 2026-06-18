'use client'

import { buildTrackReport, type ReportFeatures, type Tone } from '@/lib/report'
import { CheckCircle2, AlertTriangle, XCircle, Info, Sparkles, Clock } from 'lucide-react'

const TONE: Record<Tone, { ring: string; chip: string; icon: typeof Info; iconCls: string }> = {
  good: { ring: 'border-accent/30 bg-surface-2', chip: 'text-accent', icon: CheckCircle2, iconCls: 'text-accent' },
  warn: { ring: 'border-yellow-500/30 bg-yellow-950/15', chip: 'text-yellow-400', icon: AlertTriangle, iconCls: 'text-yellow-400' },
  bad: { ring: 'border-red-500/30 bg-red-950/20', chip: 'text-red-400', icon: XCircle, iconCls: 'text-red-400' },
  info: { ring: 'border-line bg-surface/40', chip: 'text-muted', icon: Info, iconCls: 'text-muted' },
}

const READINESS = {
  ready: { label: 'Pronta', cls: 'text-accent', bar: 'bg-accent' },
  almost: { label: 'Quasi pronta', cls: 'text-yellow-400', bar: 'bg-yellow-500' },
  not: { label: 'Da sistemare', cls: 'text-red-400', bar: 'bg-red-500' },
}

export function ReportPro({ features }: { features: ReportFeatures }) {
  const report = buildTrackReport(features)
  const r = READINESS[report.readiness.level]

  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/15">
            <Sparkles className="h-4 w-4 text-accent" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-text">Report PRO</h2>
            <p className="text-xs text-muted">Analisi tecnica del tuo master</p>
          </div>
        </div>
        <span className="rounded-full border border-accent/30 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
          PRO
        </span>
      </div>

      {/* Readiness */}
      <div className="mb-6 rounded-xl border border-line bg-surface-2/40 p-4">
        <div className="mb-2 flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted">Pronta per la demo?</p>
            <p className={`text-2xl font-bold ${r.cls}`}>{r.label}</p>
          </div>
          <p className="text-3xl font-bold text-text">{report.readiness.score}<span className="text-base text-faint">/100</span></p>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
          <div className={`h-full rounded-full ${r.bar}`} style={{ width: `${report.readiness.score}%` }} />
        </div>
        <p className="mt-2 text-sm text-muted">{report.readiness.headline}</p>
      </div>

      {/* Sections */}
      <div className="space-y-6">
        {report.sections.map((section) => (
          <div key={section.id}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{section.title}</h3>
            <div className="space-y-3">
              {section.items.map((item) => {
                const t = TONE[item.tone]
                const Icon = t.icon
                return (
                  <div key={item.id} className={`rounded-xl border p-4 ${t.ring}`}>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${t.iconCls}`} />
                        <div>
                          <p className="text-sm font-medium text-text">{item.title}</p>
                          <p className="mt-0.5 text-sm text-muted">{item.verdict}</p>
                          {item.advice && (
                            <p className="mt-2 text-sm leading-relaxed text-muted">{item.advice}</p>
                          )}
                        </div>
                      </div>
                      <span className={`shrink-0 text-lg font-bold ${t.chip}`}>{item.value}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Pending (onestà: cosa arriva con il worker v2) */}
      {report.pending.length > 0 && (
        <div className="mt-6 rounded-xl border border-dashed border-line bg-surface-2/20 p-4">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
            <Clock className="h-3.5 w-3.5" />
            In arrivo nel report
          </div>
          <ul className="space-y-1">
            {report.pending.map((p) => (
              <li key={p} className="flex items-center gap-2 text-sm text-muted">
                <span className="text-faint">—</span>{p}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
