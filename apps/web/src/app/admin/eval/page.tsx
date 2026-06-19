'use client'

import { useState } from 'react'
import { Target, Loader2, AlertTriangle } from 'lucide-react'

interface PerLabel { labelId: string; tracks: number; hitRateTop5: number; avgRank: number }
interface VersionInfo { distribution: Record<string, number>; untagged: number; distinct: string[]; mixed: boolean; dominant: string | null }
interface EvalResult {
  tracksEvaluated: number; labelsCovered: number
  precisionAt1: number; precisionAt3: number; precisionAt5: number; mrr: number
  perLabel: PerLabel[]; tracksLoaded: number; sampled: boolean; version?: VersionInfo
}

const pct = (x: number) => (x * 100).toFixed(1) + '%'

export default function EvalPage() {
  const [data, setData] = useState<EvalResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  const run = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/admin/eval', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Errore')
      setData(d)
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setLoading(false) }
  }

  const baseline = data ? 1 / Math.max(1, data.labelsCovered) : 0

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text">Validazione del matching</h1>
          <p className="mt-1 max-w-2xl text-muted">
            Test leave-one-out sul catalogo reale: ogni traccia viene matchata come fosse una demo e
            si guarda se la <strong className="text-text">sua vera label</strong> finisce in cima.
            È il numero di <strong className="text-text">credibilità</strong> dell’algoritmo.
          </p>
        </div>
        <button onClick={run} disabled={loading}
          className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
          {loading ? 'Calcolo…' : 'Esegui validazione'}
        </button>
      </header>

      {err && <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertTriangle className="h-4 w-4" /> {err}</div>}

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Metric label="Precision@1" value={pct(data.precisionAt1)} hint="la label giusta è la 1ª" highlight />
            <Metric label="Precision@3" value={pct(data.precisionAt3)} hint="giusta entro le prime 3" />
            <Metric label="Precision@5" value={pct(data.precisionAt5)} hint="giusta entro le prime 5" />
            <Metric label="MRR" value={data.mrr.toFixed(3)} hint="1.0 = sempre 1ª" />
          </div>

          <div className="rounded-xl border border-line bg-surface/40 px-4 py-3 text-sm text-muted">
            Valutate <strong className="text-text">{data.tracksEvaluated}</strong> tracce su <strong className="text-text">{data.labelsCovered}</strong> label
            (caricate {data.tracksLoaded}{data.sampled ? ', campionate per i tempi' : ''}).
            Baseline a caso ≈ <strong className="text-text">{pct(baseline)}</strong> per @1 →
            l’algoritmo è <strong className="text-accent">{(data.precisionAt1 / Math.max(baseline, 1e-9)).toFixed(1)}×</strong> meglio del caso.
          </div>

          {data.version && (
            data.version.mixed
              ? <div className="flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertTriangle className="h-4 w-4 shrink-0" /> Catalogo a embedding <strong>MISTO</strong> ({Object.entries(data.version.distribution).map(([k, v]) => `${k}:${v}`).join(', ')}). I vettori di modelli diversi non sono confrontabili → <strong>rianalizza tutto</strong> per uniformare.</div>
              : data.version.distinct.length === 1
                ? <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted">Embedding coerente: tutte su <strong className="text-accent">{data.version.distinct[0]}</strong>{data.version.untagged ? ` (+${data.version.untagged} non taggate)` : ''}. ✓</div>
                : <div className="rounded-xl border border-line bg-surface/40 px-4 py-3 text-sm text-muted">Versione embedding non ancora tracciata. Applica la migration <strong>0014</strong> e rianalizza per attivare la diagnostica.</div>
          )}

          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
                <tr><th className="px-4 py-2 font-medium">Label</th><th className="px-4 py-2 font-medium">Tracce</th><th className="px-4 py-2 font-medium">Hit top-5</th><th className="px-4 py-2 font-medium">Rank medio</th></tr>
              </thead>
              <tbody>
                {data.perLabel.map((l) => (
                  <tr key={l.labelId} className="border-t border-line">
                    <td className="px-4 py-2 font-mono text-xs text-muted">{l.labelId.slice(0, 8)}</td>
                    <td className="px-4 py-2 text-text">{l.tracks}</td>
                    <td className={`px-4 py-2 font-semibold ${l.hitRateTop5 >= 0.66 ? 'text-accent' : l.hitRateTop5 >= 0.33 ? 'text-yellow-400' : 'text-red-400'}`}>{pct(l.hitRateTop5)}</td>
                    <td className="px-4 py-2 text-muted">{l.avgRank.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!data && !loading && <p className="py-12 text-center text-muted">Premi «Esegui validazione» per calcolare l’accuratezza sul catalogo attuale.</p>}
    </div>
  )
}

function Metric({ label, value, hint, highlight }: { label: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${highlight ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface/40'}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${highlight ? 'text-accent' : 'text-text'}`}>{value}</p>
      <p className="mt-1 text-xs text-faint">{hint}</p>
    </div>
  )
}
