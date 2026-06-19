'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Disc, Layers, Activity, TrendingUp, Gauge } from 'lucide-react'

interface MapLabel {
  name: string; genre: string; tracks: number; confidence: number; solid: boolean
  sim: { x: number; y: number }
  feat: { brightness: number; punch: number; sub: number; mid: number; lufs: number }
  coherence: number
}

const RADAR_COLORS = ['rgb(212,248,77)', 'rgb(96,165,250)', 'rgb(244,114,182)', 'rgb(251,191,36)', 'rgb(45,212,191)', 'rgb(248,113,113)', 'rgb(167,139,250)', 'rgb(248,150,30)']
interface Insights {
  kpi: { labels: number; tracks: number; analyzed: number; analyzing: number; pending: number; failed: number; analyzedPct: number; avgConfidence: number; profiledLabels: number }
  genres: { genre: string; labels: number; tracks: number }[]
  map: MapLabel[]
  ranking: { name: string; genre: string; tracks: number; analyzed: number; confidence: number; solid: boolean }[]
  evolution: { date: string; added: number; analyzed: number }[]
}

export default function InsightsPage() {
  const [data, setData] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)
  const [sel, setSel] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/admin/insights', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d: Insights) => {
        setData(d)
        // preseleziona le 3 label più grandi per il radar
        setSel(new Set([...d.map].sort((a, b) => b.tracks - a.tracks).slice(0, 3).map((l) => l.name)))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Assi del radar (caratteristiche normalizzate sul catalogo)
  const radar = useMemo(() => {
    const m = data?.map ?? []
    const axes = [
      { label: 'Brillantezza', get: (l: MapLabel) => l.feat.brightness },
      { label: 'Percussività', get: (l: MapLabel) => l.feat.punch },
      { label: 'Sub-bass', get: (l: MapLabel) => l.feat.sub },
      { label: 'Medi', get: (l: MapLabel) => l.feat.mid },
      { label: 'Loudness', get: (l: MapLabel) => l.feat.lufs },
      { label: 'Coerenza', get: (l: MapLabel) => l.coherence },
    ]
    if (!m.length) return { axes: axes.map((a) => a.label), labels: [] as { name: string; tracks: number; values: number[] }[] }
    const ranges = axes.map((a) => { const vs = m.map(a.get); return { min: Math.min(...vs), max: Math.max(...vs) } })
    const labels = m.map((l) => ({
      name: l.name, tracks: l.tracks,
      values: axes.map((a, i) => { const { min, max } = ranges[i]; return max > min ? (a.get(l) - min) / (max - min) : 0.5 }),
    }))
    return { axes: axes.map((a) => a.label), labels }
  }, [data])

  const toggle = (name: string) => setSel((s) => { const n = new Set(s); n.has(name) ? n.delete(name) : n.add(name); return n })
  const selected = radar.labels.filter((l) => sel.has(l.name)).map((l, i) => ({ ...l, color: RADAR_COLORS[i % RADAR_COLORS.length] }))

  if (loading) return <div className="flex items-center gap-2 py-20 text-muted"><Loader2 className="h-5 w-5 animate-spin" /> Carico le statistiche…</div>
  if (!data) return <div className="py-20 text-muted">Errore nel caricamento.</div>

  const k = data.kpi
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold text-text">Insights del catalogo</h1>
        <p className="mt-1 text-sm text-muted">Posizionamento sonoro delle label, statistiche e crescita del database.</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={<Disc className="h-4 w-4" />} label="Label" value={k.labels} />
        <Kpi icon={<Layers className="h-4 w-4" />} label="Tracce" value={k.tracks.toLocaleString('it-IT')} />
        <Kpi icon={<Activity className="h-4 w-4" />} label="Analizzate" value={`${k.analyzedPct}%`} sub={`${k.analyzed.toLocaleString('it-IT')}`} accent />
        <Kpi icon={<Loader2 className="h-4 w-4" />} label="In coda" value={k.pending.toLocaleString('it-IT')} />
        <Kpi icon={<Gauge className="h-4 w-4" />} label="Confidence media" value={`${Math.round(k.avgConfidence * 100)}%`} />
        <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Profili pronti" value={k.profiledLabels} sub={`su ${k.labels}`} />
      </div>

      {/* CONFRONTO SONORO — RADAR */}
      <section className="rounded-2xl border border-line bg-surface/50 p-5">
        <h2 className="font-display text-lg font-bold text-text">Confronto sonoro delle label</h2>
        <p className="mb-4 text-xs text-muted">Seleziona le label da sovrapporre: ogni asse è una caratteristica (normalizzata sul catalogo). Più la forma si allarga su un asse, più quella qualità è marcata.</p>

        {radar.labels.length === 0 ? (
          <p className="py-12 text-center text-sm text-muted">Nessuna label analizzata ancora. Le label compaiono man mano che vengono analizzate.</p>
        ) : (
          <>
            <div className="mb-5 flex flex-wrap gap-2">
              {radar.labels.map((l) => {
                const on = sel.has(l.name)
                const col = selected.find((s) => s.name === l.name)?.color
                return (
                  <button key={l.name} onClick={() => toggle(l.name)}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on ? 'border-text/40 text-text' : 'border-line text-muted hover:text-text'}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? col : 'var(--line)' }} />
                    {l.name}
                  </button>
                )
              })}
            </div>
            {selected.length === 0
              ? <p className="py-12 text-center text-sm text-muted">Seleziona almeno una label qui sopra.</p>
              : <RadarChart axes={radar.axes} items={selected} />}
          </>
        )}
      </section>

      {/* EVOLUZIONE */}
      <section className="rounded-2xl border border-line bg-surface/50 p-5">
        <h2 className="mb-1 font-display text-lg font-bold text-text">Evoluzione del catalogo</h2>
        <p className="mb-4 text-xs text-muted">Tracce aggiunte vs analizzate, cumulato nel tempo.</p>
        {data.evolution.length < 2 ? (
          <p className="py-8 text-center text-sm text-muted">Ancora pochi dati per il grafico temporale.</p>
        ) : (
          <EvolutionChart points={data.evolution} />
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* CLASSIFICA */}
        <section className="rounded-2xl border border-line bg-surface/50 p-5">
          <h2 className="mb-4 font-display text-lg font-bold text-text">Classifica label</h2>
          <div className="space-y-2.5">
            {data.ranking.slice(0, 20).map((r, i) => {
              const max = data.ranking[0]?.tracks || 1
              return (
                <div key={r.name} className="flex items-center gap-3">
                  <span className="w-5 shrink-0 text-right text-xs text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium text-text">{r.name}</span>
                      <span className="shrink-0 text-xs text-muted">
                        {r.tracks} {r.solid ? <span className="text-accent">· solido</span> : <span className="text-yellow-400">· in costr.</span>}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className={`h-full rounded-full ${r.solid ? 'bg-accent' : 'bg-yellow-400'}`} style={{ width: `${Math.round((r.tracks / max) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* COERENZA INTERNA */}
        <section className="rounded-2xl border border-line bg-surface/50 p-5">
          <h2 className="mb-1 font-display text-lg font-bold text-text">Coerenza interna del sound</h2>
          <p className="mb-4 text-xs text-muted">Quanto è identitario il suono di una label (alta = molto riconoscibile, bassa = eclettica).</p>
          <div className="space-y-2.5">
            {[...data.map].sort((a, b) => b.coherence - a.coherence).slice(0, 20).map((l) => (
              <div key={l.name} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-text">{l.name}</span>
                    <span className="shrink-0 text-xs text-muted">{Math.round(l.coherence * 100)}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                    <div className="h-full rounded-full bg-blue-400" style={{ width: `${Math.round(l.coherence * 100)}%` }} />
                  </div>
                </div>
              </div>
            ))}
            {data.map.length === 0 && <p className="text-sm text-muted">Nessuna label analizzata ancora.</p>}
          </div>
        </section>
      </div>
    </div>
  )
}

function Kpi({ icon, label, value, sub, accent }: { icon: React.ReactNode; label: string; value: string | number; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-xs text-muted">{icon}<span className="truncate">{label}</span></div>
      <div className={`text-2xl font-bold ${accent ? 'text-accent' : 'text-text'}`}>{value}</div>
      {sub && <div className="text-xs text-faint">{sub}</div>}
    </div>
  )
}

// ─── Radar chart (SVG) ────────────────────────────────────────────────────────
function RadarChart({ axes, items }: { axes: string[]; items: { name: string; color: string; values: number[] }[] }) {
  const W = 560, H = 460, cx = 280, cy = 220, R = 150
  const N = axes.length
  const ang = (i: number) => -Math.PI / 2 + i * ((2 * Math.PI) / N)
  const pt = (i: number, v: number): [number, number] => [cx + R * v * Math.cos(ang(i)), cy + R * v * Math.sin(ang(i))]
  const polyAt = (v: number) => axes.map((_, i) => pt(i, v).join(',')).join(' ')
  const rings = [0.25, 0.5, 0.75, 1]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto w-full" style={{ maxWidth: 620 }}>
        {rings.map((r) => <polygon key={r} points={polyAt(r)} fill="none" stroke="var(--line)" strokeOpacity={0.5} strokeWidth={1} />)}
        {axes.map((a, i) => {
          const [ex, ey] = pt(i, 1), [lx, ly] = pt(i, 1.16)
          const anchor = lx > cx + 6 ? 'start' : lx < cx - 6 ? 'end' : 'middle'
          return (
            <g key={a}>
              <line x1={cx} y1={cy} x2={ex} y2={ey} stroke="var(--line)" strokeOpacity={0.5} strokeWidth={1} />
              <text x={lx} y={ly + 3} textAnchor={anchor} className="fill-[var(--muted)] text-[12px] font-medium">{a}</text>
            </g>
          )
        })}
        {items.map((it) => (
          <polygon key={it.name} points={it.values.map((v, i) => pt(i, v).join(',')).join(' ')} fill={it.color} fillOpacity={0.13} stroke={it.color} strokeWidth={2} strokeLinejoin="round" />
        ))}
        {items.map((it) => it.values.map((v, i) => {
          const [px, py] = pt(i, v)
          return <circle key={`${it.name}-${i}`} cx={px} cy={py} r={2.6} fill={it.color} />
        }))}
      </svg>
    </div>
  )
}

// ─── Evolution chart (SVG) ────────────────────────────────────────────────────
function EvolutionChart({ points }: { points: { date: string; added: number; analyzed: number }[] }) {
  const W = 760, H = 280, pad = 44
  const n = points.length
  const maxY = Math.max(...points.map((p) => p.added), 1)
  const px = (i: number) => pad + (i / Math.max(1, n - 1)) * (W - 2 * pad)
  const py = (v: number) => (H - pad) - (v / maxY) * (H - 2 * pad)
  const line = (key: 'added' | 'analyzed') => points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${px(i)} ${py(p[key])}`).join(' ')
  const area = `${line('added')} L ${px(n - 1)} ${H - pad} L ${px(0)} ${H - pad} Z`
  const last = points[n - 1]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 520 }}>
        {/* griglia y */}
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={pad} y1={py(maxY * f)} x2={W - pad} y2={py(maxY * f)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 4" />
            <text x={pad - 8} y={py(maxY * f) + 4} textAnchor="end" className="fill-[var(--faint)] text-[10px]">{Math.round(maxY * f)}</text>
          </g>
        ))}
        <path d={area} fill="var(--accent)" fillOpacity={0.12} />
        <path d={line('added')} fill="none" stroke="var(--accent)" strokeWidth="2" />
        <path d={line('analyzed')} fill="none" stroke="rgb(96 165 250)" strokeWidth="2" />
        {/* date estremi */}
        <text x={pad} y={H - 14} textAnchor="start" className="fill-[var(--faint)] text-[10px]">{points[0].date}</text>
        <text x={W - pad} y={H - 14} textAnchor="end" className="fill-[var(--faint)] text-[10px]">{last.date}</text>
      </svg>
      <div className="mt-1 flex gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-text"><span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" /> aggiunte ({last.added.toLocaleString('it-IT')})</span>
        <span className="flex items-center gap-1.5 text-text"><span className="inline-block h-2.5 w-2.5 rounded-full bg-blue-400" /> analizzate ({last.analyzed.toLocaleString('it-IT')})</span>
      </div>
    </div>
  )
}
