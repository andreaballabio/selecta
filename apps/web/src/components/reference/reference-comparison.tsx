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
    <section className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-6">
      <div className="mb-1 flex items-center gap-2">
        <GitCompareArrows className="h-5 w-5 text-emerald-400" />
        <h2 className="text-lg font-bold text-white">Il tuo suono vs {labelName}</h2>
      </div>
      <p className="mb-5 text-xs text-zinc-500">
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
                <span className="font-medium text-zinc-300">{axis.label}</span>
                <span className={inLine ? 'text-xs text-zinc-500' : `text-xs ${more ? 'text-emerald-400' : 'text-yellow-400'}`}>
                  {word}
                </span>
              </div>

              <div className="relative h-2 rounded-full bg-zinc-900">
                <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-zinc-600" />
                {!inLine && (
                  <div
                    className={`absolute top-0 h-full ${more ? 'rounded-r-full bg-emerald-500' : 'rounded-l-full bg-yellow-500'}`}
                    style={more ? { left: '50%', width: `${halfPct}%` } : { right: '50%', width: `${halfPct}%` }}
                  />
                )}
              </div>

              <div className="mt-1 flex items-center justify-between text-xs text-zinc-600">
                <span>tu <span className="text-zinc-400">{axis.fmt(u)}</span></span>
                <span><span className="text-zinc-400">{axis.fmt(r)}</span> {labelName}</span>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
