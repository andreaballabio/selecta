'use client'

import { useEffect, useState } from 'react'
import { Gauge, TrendingUp, Loader2 } from 'lucide-react'

interface Score { demoScore: number; readiness: number; fit: number; topLabel: string | null; percentile: number | null; sampleSize: number; small: boolean }

export function DemoScore({ submissionId }: { submissionId: string }) {
  const [s, setS] = useState<Score | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/demo-score?submission_id=${submissionId}`).then((r) => r.json()).then((d) => { if (d.demoScore != null) setS(d); setLoading(false) }).catch(() => setLoading(false))
  }, [submissionId])

  if (loading) return <div className="rounded-2xl border border-line bg-surface/40 p-6 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
  if (!s) return null

  // Frase di confronto onesta (fascia se campione piccolo)
  let compare: string | null = null
  if (s.percentile != null) {
    if (s.small) compare = s.percentile >= 50 ? 'Sopra la media delle prime demo analizzate' : 'Campione ancora piccolo: dato indicativo'
    else compare = `Suona “firmabile” più del ${s.percentile}% delle ${s.sampleSize} demo analizzate`
  }
  const color = s.demoScore >= 75 ? 'text-accent' : s.demoScore >= 55 ? 'text-amber-400' : 'text-red-400'

  return (
    <div className="rounded-2xl border border-line bg-surface/50 p-6">
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className={`font-display text-5xl font-bold tabular-nums ${color}`}>{s.demoScore}</p>
          <p className="text-xs uppercase tracking-wider text-faint">Demo Score</p>
        </div>
        <div className="flex-1 border-l border-line pl-5">
          <p className="flex items-center gap-2 text-sm font-semibold text-text"><Gauge className="h-4 w-4 text-accent" /> Quanto è pronta</p>
          <div className="mt-3 space-y-2">
            <Bar label="Mix / master" value={s.readiness} />
            <Bar label="Fit col sound delle label" value={s.fit} />
          </div>
          {compare && (
            <p className="mt-3 flex items-center gap-1.5 text-sm text-muted"><TrendingUp className="h-4 w-4 text-accent" /> {compare}</p>
          )}
          {s.topLabel && <p className="mt-1 text-sm text-muted">Più vicina al sound di <span className="font-medium text-text">{s.topLabel}</span></p>}
        </div>
      </div>
    </div>
  )
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs"><span className="text-muted">{label}</span><span className="tabular-nums text-text">{value}</span></div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, value)}%` }} /></div>
    </div>
  )
}
