'use client'

import { useState } from 'react'
import { Target, Loader2, AlertTriangle, Copy, Check } from 'lucide-react'

interface PerLabel { labelId: string; tracks: number; hitRateTop5: number; avgRank: number }
interface VersionInfo { distribution: Record<string, number>; untagged: number; distinct: string[]; mixed: boolean; dominant: string | null }
interface EvalResult {
  tracksEvaluated: number; labelsCovered: number
  precisionAt1: number; precisionAt3: number; precisionAt5: number; mrr: number
  perLabel: PerLabel[]; tracksLoaded: number; sampled: boolean; version?: VersionInfo; versionColumnExists?: boolean
}

const pct = (x: number) => (x * 100).toFixed(1) + '%'

interface DimRes { p1: number; p3: number; p5: number; mrr: number; labels: number }
interface Experiment { requested: number; embedded: number; workerErrors: number; dim64: DimRes; dim256: DimRes }

export default function EvalPage() {
  const [data, setData] = useState<EvalResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [exp, setExp] = useState<Experiment | null>(null)
  const [expLoading, setExpLoading] = useState(false)
  const [expErr, setExpErr] = useState('')
  // Storico di tutte le esecuzioni (per esportarle e fartele analizzare).
  const [runs, setRuns] = useState<EvalResult[]>([])
  const [exps, setExps] = useState<Experiment[]>([])
  const [copied, setCopied] = useState(false)

  const run = async () => {
    setLoading(true); setErr('')
    try {
      const r = await fetch('/api/admin/eval', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Errore')
      setData(d); setRuns((prev) => [...prev, d])
    } catch (e) { setErr(e instanceof Error ? e.message : 'Errore') }
    finally { setLoading(false) }
  }

  const runExperiment = async () => {
    setExpLoading(true); setExpErr('')
    try {
      const r = await fetch('/api/admin/eval-experiment?n=80', { cache: 'no-store' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Errore')
      setExp(d); setExps((prev) => [...prev, d])
    } catch (e) { setExpErr(e instanceof Error ? e.message : 'Errore (il worker ci mette qualche minuto)') }
    finally { setExpLoading(false) }
  }

  // Blocco JSON con TUTTE le esecuzioni, da incollare nella chat per l'analisi.
  const exportText = JSON.stringify(
    { tool: 'selecta-eval-export', exportedAt: new Date().toISOString(), validationRuns: runs, experimentRuns: exps },
    (_k, v) => (typeof v === 'number' ? Number(v.toFixed(4)) : v),
    2,
  )
  const copyExport = async () => {
    try { await navigator.clipboard.writeText(exportText); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* fallback: textarea */ }
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
          {/* Sintesi a colpo d'occhio (verdetto leggibile, niente da interpretare) */}
          {(() => {
            const ratio = data.precisionAt1 / Math.max(baseline, 1e-9)
            const q = ratio >= 8 && data.precisionAt5 >= 0.6
              ? { t: 'Forte', cls: 'border-accent/40 bg-accent/10 text-accent' }
              : ratio >= 4
                ? { t: 'Buono', cls: 'border-accent/30 bg-accent/5 text-text' }
                : ratio >= 2
                  ? { t: 'Discreto', cls: 'border-yellow-500/30 bg-yellow-950/15 text-yellow-300' }
                  : { t: 'Debole', cls: 'border-red-500/30 bg-red-950/20 text-red-300' }
            return (
              <div className={`rounded-2xl border p-4 ${q.cls}`}>
                <p className="text-base">
                  <strong>{q.t}.</strong> La label giusta è nei primi 5 nel{' '}
                  <strong>{pct(data.precisionAt5)}</strong> dei casi —{' '}
                  <strong>{ratio.toFixed(1)}×</strong> meglio del caso (1ª nel {pct(data.precisionAt1)}).
                </p>
              </div>
            )
          })()}

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
                : data.versionColumnExists
                  ? <div className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3 text-sm text-muted">Migration <strong>0014</strong> applicata ✓. Le tracce verranno etichettate man mano che le rianalizzi/importi; le esistenti restano valide (il match non cambia). La diagnostica diventa verde quando ci sono tracce etichettate.</div>
                  : <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/15 px-4 py-3 text-sm text-yellow-300">Colonna versione assente: esegui la migration <strong>0014</strong> su Supabase.</div>
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

      {/* Esperimento A/B: dimensione embedding 64 vs 256 */}
      <section className="mt-4 rounded-2xl border border-line bg-surface/40 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-text">Esperimento: 64 vs 256 dimensioni</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">Ri-calcola l’impronta su un campione (~100 tracce) sia a 64 che a 256 dim e confronta la precisione. Non tocca nulla: serve a decidere se vale la migrazione a 256. Richiede ~2-4 minuti (il worker rielabora l’audio).</p>
          </div>
          <button onClick={runExperiment} disabled={expLoading}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-accent/50 px-5 py-2.5 text-sm font-semibold text-accent disabled:opacity-50">
            {expLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
            {expLoading ? 'In corso… (qualche minuto)' : 'Esegui esperimento'}
          </button>
        </div>

        {expErr && <div className="mt-3 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"><AlertTriangle className="h-4 w-4" /> {expErr}</div>}

        {exp && exp.embedded < 20 && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            <strong>Esperimento non valido:</strong> solo {exp.embedded}/{exp.requested} tracce elaborate dal worker.
            {exp.workerErrors > 0
              ? ` Il worker non ha risposto (${exp.workerErrors} blocchi falliti): hai ricaricato app.py su HF? Controlla che /health sia "healthy" e che il rebuild dello Space sia finito, poi rilancia.`
              : ' Il worker ha risposto ma non è riuscito a scaricare/elaborare le preview (URL scaduti?). Rilancia; se persiste, le preview del campione vanno rinfrescate.'}
          </div>
        )}

        {exp && exp.embedded >= 20 && (() => {
          const imprP5 = exp.dim64.p5 > 0 ? (exp.dim256.p5 - exp.dim64.p5) / exp.dim64.p5 : 0
          const imprMrr = exp.dim64.mrr > 0 ? (exp.dim256.mrr - exp.dim64.mrr) / exp.dim64.mrr : 0
          const best = Math.max(imprP5, imprMrr)
          const verdict = best >= 0.10
            ? { t: `256 conviene: +${Math.round(best * 100)}% di precisione → migra ora che il catalogo è piccolo.`, cls: 'border-accent/40 bg-accent/10 text-accent' }
            : best <= -0.03
              ? { t: 'Resta a 64: il 256 non migliora (anzi peggiora). Niente migrazione.', cls: 'border-line bg-surface/40 text-muted' }
              : { t: 'Guadagno marginale: non vale la migrazione adesso. Resta a 64.', cls: 'border-yellow-500/30 bg-yellow-950/15 text-yellow-300' }
          const Row = ({ k, a, b }: { k: string; a: number; b: number }) => (
            <tr className="border-t border-line">
              <td className="px-4 py-2 text-muted">{k}</td>
              <td className="px-4 py-2 text-text">{pct(a)}</td>
              <td className={`px-4 py-2 font-semibold ${b > a ? 'text-accent' : b < a ? 'text-red-400' : 'text-text'}`}>{pct(b)}</td>
            </tr>
          )
          return (
            <div className="mt-4 space-y-3">
              <div className={`rounded-xl border p-3 text-sm ${verdict.cls}`}><strong>Verdetto:</strong> {verdict.t}</div>
              <p className="text-xs text-faint">Campione: {exp.embedded}/{exp.requested} tracce ri-elaborate{exp.workerErrors ? `, ${exp.workerErrors} blocchi falliti` : ''}. È una stima: rilancia per confermare.</p>
              <div className="overflow-hidden rounded-2xl border border-line">
                <table className="w-full text-sm">
                  <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
                    <tr><th className="px-4 py-2 font-medium">Metrica</th><th className="px-4 py-2 font-medium">64 dim (attuale)</th><th className="px-4 py-2 font-medium">256 dim</th></tr>
                  </thead>
                  <tbody>
                    <Row k="Precision@1" a={exp.dim64.p1} b={exp.dim256.p1} />
                    <Row k="Precision@3" a={exp.dim64.p3} b={exp.dim256.p3} />
                    <Row k="Precision@5" a={exp.dim64.p5} b={exp.dim256.p5} />
                    <tr className="border-t border-line"><td className="px-4 py-2 text-muted">MRR</td><td className="px-4 py-2 text-text">{exp.dim64.mrr.toFixed(3)}</td><td className={`px-4 py-2 font-semibold ${exp.dim256.mrr > exp.dim64.mrr ? 'text-accent' : 'text-red-400'}`}>{exp.dim256.mrr.toFixed(3)}</td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          )
        })()}
      </section>

      {/* Esporta per l'analisi: incolla questo JSON nella chat */}
      {(runs.length > 0 || exps.length > 0) && (
        <section className="mt-4 rounded-2xl border border-line bg-surface/40 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold text-text">Esporta per l’analisi</h2>
              <p className="mt-1 text-sm text-muted">Registrate <strong className="text-text">{runs.length}</strong> validazioni e <strong className="text-text">{exps.length}</strong> esperimenti. Lancia 2-3 volte, poi copia e incolla questo nella chat.</p>
            </div>
            <button onClick={copyExport}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Copiato!' : 'Copia risultati'}
            </button>
          </div>
          <textarea readOnly value={exportText} onFocus={(e) => e.currentTarget.select()}
            className="mt-3 h-48 w-full resize-y rounded-xl border border-line bg-surface-2 p-3 font-mono text-xs text-muted focus:border-accent focus:outline-none" />
        </section>
      )}
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
