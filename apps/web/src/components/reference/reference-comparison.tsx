'use client'

import { GitCompareArrows, CheckCircle2 } from 'lucide-react'
import { compareToReference, closeness, type FeatureSet, type AxisStatus } from '@/lib/reference-match'

/**
 * Reference Matching — confronta il suono dell'utente con la media della label che
 * lo matcha meglio, asse per asse, e dà CONSIGLI azionabili ancorati ai numeri.
 * Riusa i dati già calcolati dal match (nessuna analisi extra). Barre divergenti:
 * centro = media label, destra (verde) = tu sopra, sinistra (giallo) = tu sotto.
 */
const wordTone: Record<AxisStatus, string> = { ok: 'text-muted', low: 'text-yellow-400', high: 'text-accent' }

export function ReferenceComparison({
  user,
  labelAvg,
  labelName,
}: {
  user: Record<string, number | null>
  labelAvg: Record<string, number>
  labelName: string
}) {
  const axes = compareToReference(user as FeatureSet, labelAvg as FeatureSet)
  if (axes.length === 0) return null
  const close = closeness(axes)
  const todo = axes.filter((a) => a.status !== 'ok').length

  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-6">
      <div className="mb-1 flex items-center gap-2">
        <GitCompareArrows className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-text">Come avvicinarti a {labelName}</h2>
      </div>
      <p className="mb-5 text-xs text-muted">
        Il tuo suono vs il sound medio della label — <strong className="text-text">{close}% in linea</strong>
        {todo > 0 && <>, {todo} {todo === 1 ? 'ritocco' : 'ritocchi'} per avvicinarti</>}.
      </p>

      <div className="space-y-4">
        {axes.map((a) => {
          const halfPct = Math.abs(a.magnitude) * 50
          const above = a.magnitude >= 0
          return (
            <div key={a.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-text">{a.axis}</span>
                <span className={`text-xs ${wordTone[a.status]}`}>{a.word}</span>
              </div>

              <div className="relative h-2 rounded-full bg-surface-2">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-faint" />
                {a.status !== 'ok' && (
                  <div
                    className={`absolute top-0 h-full ${above ? 'rounded-r-full bg-accent' : 'rounded-l-full bg-yellow-500'}`}
                    style={above ? { left: '50%', width: `${halfPct}%` } : { right: '50%', width: `${halfPct}%` }}
                  />
                )}
              </div>

              <div className="mt-1 flex items-center justify-between text-xs text-faint">
                <span>tu <span className="text-muted">{a.user}</span></span>
                <span><span className="text-muted">{a.ref}</span> {labelName}</span>
              </div>

              {a.advice
                ? <p className="mt-1 text-xs text-muted">→ {a.advice}</p>
                : <p className="mt-1 flex items-center gap-1 text-xs text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> in linea</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
