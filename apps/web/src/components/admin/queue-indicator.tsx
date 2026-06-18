'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, CheckCircle2, AlertTriangle, Activity } from 'lucide-react'

interface LabelStat { name: string; total: number; analyzed: number; analyzing: number; pending: number; failed: number }
interface Status {
  global: { total: number; analyzed: number; analyzing: number; pending: number; failed: number }
  remaining: number
  working: boolean
  progress: number
  labels: LabelStat[]
}

/** Indicatore in navbar admin: mostra lo stato dell'analisi (coda globale) e,
 *  cliccando, il dettaglio per label. Fa polling adattivo (veloce se sta
 *  lavorando, lento se è tutto fermo). */
export default function QueueIndicator() {
  const [status, setStatus] = useState<Status | null>(null)
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const r = await fetch('/api/admin/queue-status', { cache: 'no-store' })
        if (r.ok && alive) {
          const d: Status = await r.json()
          setStatus(d)
          schedule(d.working ? 5000 : 20000)
          return
        }
      } catch { /* ignora */ }
      schedule(20000)
    }
    const schedule = (ms: number) => {
      if (!alive) return
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(tick, ms)
    }
    tick()
    return () => { alive = false; if (timer.current) clearTimeout(timer.current) }
  }, [])

  if (!status) return null
  const g = status.global

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-xs font-medium text-muted hover:text-text"
        title="Stato analisi audio"
      >
        {status.working ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-accent" />
            <span className="text-text">{status.remaining}</span>
            <span className="hidden sm:inline">in coda</span>
          </>
        ) : g.failed > 0 ? (
          <>
            <AlertTriangle className="h-3.5 w-3.5 text-yellow-400" />
            <span className="hidden sm:inline">{g.analyzed}/{g.total} · {g.failed} ko</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
            <span className="hidden sm:inline">{g.analyzed} analizzate</span>
          </>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-line bg-surface p-3 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4 text-accent" />
              <p className="text-sm font-semibold text-text">Analisi audio</p>
            </div>

            {/* Barra globale */}
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>{g.analyzed}/{g.total} analizzate</span>
              <span>{status.progress}%</span>
            </div>
            <div className="mb-3 h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${status.progress}%` }} />
            </div>
            <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {g.analyzing > 0 && <span className="text-accent">▶ {g.analyzing} in analisi</span>}
              {g.pending > 0 && <span className="text-yellow-400">⏳ {g.pending} in coda</span>}
              {g.failed > 0 && <span className="text-red-400">✗ {g.failed} falliti</span>}
              {status.remaining === 0 && <span className="text-muted">Tutto analizzato ✓</span>}
            </div>

            {status.remaining > 0 && (
              <p className="mb-3 rounded-lg bg-surface-2/60 px-2.5 py-2 text-[11px] leading-snug text-faint">
                L&apos;analisi prosegue in background sul server — puoi chiudere il computer.
              </p>
            )}

            {/* Per label */}
            <div className="max-h-64 space-y-2 overflow-auto">
              {status.labels.map((l) => {
                const pct = l.total > 0 ? Math.round((l.analyzed / l.total) * 100) : 0
                const rem = l.pending + l.analyzing
                return (
                  <div key={l.name} className="rounded-lg bg-surface-2/50 px-2.5 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-medium text-text">{l.name}</span>
                      <span className="shrink-0 text-[11px] text-muted">
                        {rem > 0 ? `${l.analyzed}/${l.total}` : `${l.analyzed} ✓`}
                        {l.failed > 0 && <span className="ml-1 text-red-400">· {l.failed} ko</span>}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${rem > 0 ? 'bg-yellow-400' : 'bg-accent'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
