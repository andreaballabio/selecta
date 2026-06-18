'use client'

import { GitCompareArrows } from 'lucide-react'

/**
 * Reference Matching v1 — confronta il suono dell'utente con la media della
 * label che lo matcha meglio, asse per asse. Riusa i dati già calcolati dal
 * match (nessuna analisi extra). Barre divergenti: centro = media label,
 * destra (verde) = tu sopra, sinistra (giallo) = tu sotto.
 */
interface Axis {
  key: string
  label: string
  fmt: (v: number) => string
  scale: number      // differenza che riempie metà barra
  more: string       // verdetto quando tu > label
  less: string       // verdetto quando tu < label
}

const AXES: Axis[] = [
  { key: 'lufs',              label: 'Loudness',     fmt: v => `${v.toFixed(1)} LUFS`, scale: 6,    more: 'più loud',       less: 'più quiet' },
  { key: 'sub_ratio',         label: 'Sub-bass',     fmt: v => `${Math.round(v * 100)}%`, scale: 0.15, more: 'più sub',     less: 'meno sub' },
  { key: 'mid_presence',      label: 'Frequenze medie', fmt: v => `${Math.round(v * 100)}%`, scale: 0.15, more: 'più presenti', less: 'più contenute' },
  { key: 'spectral_centroid', label: 'Brillantezza', fmt: v => `${Math.round(v)} Hz`,  scale: 1500, more: 'più brillante',  less: 'più scuro' },
  { key: 'onset_strength',    label: 'Groove',       fmt: v => `${Math.round(v * 100)}`, scale: 0.3,  more: 'più percussivo', less: 'più smooth' },
  { key: 'spectral_contrast', label: 'Definizione',  fmt: v => `${Math.round(v * 100)}`, scale: 0.3,  more: 'più definito',   less: 'meno definito' },
]

export function ReferenceComparison({
  user,
  labelAvg,
  labelName,
}: {
  user: Record<string, number | null>
  labelAvg: Record<string, number>
  labelName: string
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface/60 p-6">
      <div className="mb-1 flex items-center gap-2">
        <GitCompareArrows className="h-5 w-5 text-accent" />
        <h2 className="text-lg font-bold text-text">Il tuo suono vs {labelName}</h2>
      </div>
      <p className="mb-5 text-xs text-muted">
        Dove ti posizioni rispetto al sound medio della label
      </p>

      <div className="space-y-4">
        {AXES.map((axis) => {
          const u = user[axis.key]
          const r = labelAvg[axis.key]
          if (u == null || r == null || !isFinite(u) || !isFinite(r)) return null

          const diff = u - r
          const frac = Math.max(-1, Math.min(1, diff / axis.scale)) // -1..1
          const halfPct = Math.abs(frac) * 50
          const inLine = Math.abs(frac) < 0.08
          const more = diff >= 0
          const word = inLine ? 'in linea' : more ? axis.more : axis.less

          return (
            <div key={axis.key}>
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-text">{axis.label}</span>
                <span className={inLine ? 'text-xs text-muted' : `text-xs ${more ? 'text-accent' : 'text-yellow-400'}`}>
                  {word}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-surface-2">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-faint" />
                {!inLine && (
                  <div
                    className={`absolute top-0 h-full ${more ? 'rounded-r-full bg-accent' : 'rounded-l-full bg-yellow-500'}`}
                    style={more ? { left: '50%', width: `${halfPct}%` } : { right: '50%', width: `${halfPct}%` }}
                  />
                )}
              </div>

              <div className="mt-1 flex items-center justify-between text-xs text-faint">
                <span>tu <span className="text-muted">{axis.fmt(u)}</span></span>
                <span><span className="text-muted">{axis.fmt(r)}</span> {labelName}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
