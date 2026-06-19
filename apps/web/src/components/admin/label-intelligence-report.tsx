'use client'

import { useEffect, useState } from 'react'
import { Brain, Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'

interface IntelLabel {
  id: string; name: string; cataloged_tracks: number | null
  generic_weight: number | null; distinctiveness: number | null; match_reliable: boolean | null
  sound_family: string | null; nearest_name: string | null; intel_updated_at: string | null
}
interface Snapshot { run_at: string; payload: {
  labels: number; families: number; precisionAt1: number; precisionAt5: number; mrr: number
  avgHit5: number; familyList: { name: string; size: number; members: string[] }[]
  downWeight?: { on: boolean; alpha: number; precisionByAlpha: { alpha: number; p: number }[] }
} }
interface Data { labels: IntelLabel[]; snapshots: Snapshot[]; needsMigration?: boolean }

const pct = (x: number | null | undefined) => (x == null ? '—' : Math.round(x * 100) + '%')

export function LabelIntelligenceReport() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)

  const load = async () => {
    try { const r = await fetch('/api/admin/label-intelligence', { cache: 'no-store' }); setData(await r.json()) }
    catch { setData({ labels: [], snapshots: [] }) }
    finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const recompute = async () => {
    setRunning(true)
    try { await fetch('/api/admin/label-intelligence', { method: 'POST' }); await load() }
    finally { setRunning(false) }
  }

  const latest = data?.snapshots?.[0]?.payload
  const prev = data?.snapshots?.[1]?.payload
  const delta = (a?: number, b?: number) => (a == null || b == null ? null : Math.round((a - b) * 1000) / 10)
  const labelsSorted = [...(data?.labels ?? [])].sort((a, b) => (a.distinctiveness ?? 1) - (b.distinctiveness ?? 1))

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-text"><Brain className="h-5 w-5 text-accent" /> Label Intelligence</h2>
        <button onClick={recompute} disabled={running}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} {running ? 'Ricalcolo…' : 'Ricalcola'}
        </button>
      </div>
      <p className="mt-1 text-sm text-muted">Calcolata in automatico dai dati (gira ogni notte). Famiglie di suono, label «generiche» da smorzare, affidabilità del match.</p>

      {loading ? <p className="py-8 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
      : data?.needsMigration ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-950/15 px-4 py-3 text-sm text-yellow-300"><AlertTriangle className="h-4 w-4" /> Esegui la migration <strong>0017</strong> su Supabase, poi premi «Ricalcola».</div>
      : !latest ? <div className="mt-4 rounded-xl border border-line bg-surface/40 px-4 py-3 text-sm text-muted">Nessun calcolo ancora. Premi «Ricalcola» per la prima analisi.</div>
      : (
        <>
          {/* KPI + trend vs run precedente */}
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Precision@5" value={pct(latest.precisionAt5)} delta={delta(latest.precisionAt5, prev?.precisionAt5)} />
            <Kpi label="Precision@1" value={pct(latest.precisionAt1)} delta={delta(latest.precisionAt1, prev?.precisionAt1)} />
            <Kpi label="Famiglie di suono" value={String(latest.families)} delta={prev ? latest.families - prev.families : null} suffix="" />
            <Kpi label="Auto-match medio" value={pct(latest.avgHit5)} delta={delta(latest.avgHit5, prev?.avgHit5)} />
          </div>

          {/* Auto-validazione dello smorzamento "calamite" */}
          {latest.downWeight && (
            <div className={`mt-4 rounded-xl border px-4 py-3 text-sm ${latest.downWeight.on ? 'border-accent/30 bg-accent/5 text-muted' : 'border-line bg-surface/40 text-muted'}`}>
              <strong className={latest.downWeight.on ? 'text-accent' : 'text-text'}>Smorzamento calamite: {latest.downWeight.on ? `ATTIVO` : 'spento'}.</strong>{' '}
              {latest.downWeight.on
                ? `Il match riduce le label generiche (intensità ${latest.downWeight.alpha}) perché migliora/regge la precision.`
                : 'Disattivato in automatico: smorzare peggiorerebbe la precision. Il match non cambia.'}
            </div>
          )}

          {/* Famiglie */}
          {latest.familyList?.length > 0 && (
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Famiglie di suono</p>
              <div className="flex flex-wrap gap-2">
                {latest.familyList.filter((f) => f.size > 1).map((f) => (
                  <span key={f.name} className="rounded-full border border-line bg-surface-2 px-3 py-1 text-xs text-text" title={f.members.join(', ')}>
                    {f.name} <span className="text-faint">+{f.size - 1}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tabella per label (deboli in cima) */}
          <div className="mt-5 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
                <tr>
                  <th className="px-3 py-2 font-medium">Label</th>
                  <th className="px-3 py-2 font-medium">Famiglia</th>
                  <th className="px-3 py-2 font-medium">Tracce</th>
                  <th className="px-3 py-2 font-medium" title="Quanto le sue tracce ritrovano la label in top-5 (hit@5)">Auto-match</th>
                  <th className="px-3 py-2 font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">Simile a</th>
                  <th className="px-3 py-2 font-medium">Match</th>
                </tr>
              </thead>
              <tbody>
                {labelsSorted.map((l) => (
                  <tr key={l.id} className="border-t border-line">
                    <td className="px-3 py-2 font-medium text-text">{l.name}</td>
                    <td className="px-3 py-2 text-muted">{l.sound_family ?? '—'}</td>
                    <td className="px-3 py-2 text-muted">{l.cataloged_tracks ?? 0}</td>
                    <td className={`px-3 py-2 font-semibold ${(l.distinctiveness ?? 1) >= 0.4 ? 'text-accent' : (l.distinctiveness ?? 1) >= 0.25 ? 'text-yellow-400' : 'text-red-400'}`}>{pct(l.distinctiveness)}</td>
                    <td className="px-3 py-2 text-muted">{l.generic_weight == null ? '—' : l.generic_weight.toFixed(2)}</td>
                    <td className="px-3 py-2 text-faint">{l.nearest_name ?? '—'}</td>
                    <td className="px-3 py-2">{l.match_reliable === false ? <span className="text-red-400">sfocato</span> : <span className="inline-flex items-center gap-1 text-accent"><CheckCircle2 className="h-3.5 w-3.5" /> ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {data?.labels?.[0]?.intel_updated_at && <p className="mt-2 text-xs text-faint">Ultimo calcolo: {data.labels[0].intel_updated_at.slice(0, 16).replace('T', ' ')} · {data.snapshots.length} run nello storico</p>}
        </>
      )}
    </section>
  )
}

function Kpi({ label, value, delta, suffix = 'pp' }: { label: string; value: string; delta: number | null; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/40 p-4">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-text">{value}</p>
      {delta != null && delta !== 0 && (
        <p className={`mt-0.5 text-xs ${delta > 0 ? 'text-accent' : 'text-red-400'}`}>{delta > 0 ? '▲' : '▼'} {Math.abs(delta)}{suffix} vs run prec.</p>
      )}
    </div>
  )
}
