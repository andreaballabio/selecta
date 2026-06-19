'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, Disc, Layers, Activity, TrendingUp, Gauge } from 'lucide-react'

interface MapLabel {
  name: string; genre: string; tracks: number; confidence: number; solid: boolean
  sim: { x: number; y: number }
  feat: { brightness: number; punch: number; sub: number; lufs: number }
  coherence: number
}
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
  const [mode, setMode] = useState<'sim' | 'feat'>('feat')

  useEffect(() => {
    fetch('/api/admin/insights', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

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

      {/* MAPPA POSIZIONAMENTO */}
      <section className="rounded-2xl border border-line bg-surface/50 p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-bold text-text">Mappa del sound delle label</h2>
            <p className="text-xs text-muted">{mode === 'feat' ? 'Posizione = brillantezza × percussività · colore = sub-bass · dove cadrebbe una demo' : 'Vicinanza = suono complessivo simile (proiezione del timbro)'}</p>
          </div>
          <div className="flex rounded-lg border border-line p-0.5 text-xs">
            <button onClick={() => setMode('feat')} className={`rounded px-3 py-1.5 font-medium ${mode === 'feat' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text'}`}>Caratteristiche</button>
            <button onClick={() => setMode('sim')} className={`rounded px-3 py-1.5 font-medium ${mode === 'sim' ? 'bg-accent text-accent-ink' : 'text-muted hover:text-text'}`}>Similarità</button>
          </div>
        </div>
        {data.map.length < 2 ? (
          <p className="py-12 text-center text-sm text-muted">Servono almeno 2 label analizzate per la mappa. Le label in coda compariranno man mano che vengono analizzate.</p>
        ) : (
          <ScatterMap labels={data.map} mode={mode} />
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted">
          <span className="flex items-center gap-2">Sub-bass
            <span className="h-2.5 w-24 rounded-full" style={{ background: 'linear-gradient(90deg, rgb(56 189 248), rgb(212 248 77))' }} />
            <span className="text-faint">meno → più</span>
          </span>
          <span>· dimensione bolla = n° tracce</span>
          <span>· passa sopra una bolla per i dettagli</span>
        </div>
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

// ─── Scatter map (SVG) ────────────────────────────────────────────────────────
function subColor(t: number) { // t 0..1 → blu (poco sub) → lime (molto sub)
  const a = [56, 189, 248], b = [212, 248, 77]
  const c = a.map((x, i) => Math.round(x + (b[i] - x) * t))
  return `rgb(${c[0]} ${c[1]} ${c[2]})`
}

function ScatterMap({ labels, mode }: { labels: MapLabel[]; mode: 'sim' | 'feat' }) {
  const W = 900, H = 540, padL = 64, padR = 36, padT = 44, padB = 60
  const x0 = padL, x1 = W - padR, y0 = padT, y1 = H - padB
  const pts = useMemo(() => labels.map((l) => ({
    l,
    x: mode === 'sim' ? l.sim.x : l.feat.brightness,
    y: mode === 'sim' ? l.sim.y : l.feat.punch,
  })), [labels, mode])

  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y), subs = labels.map((l) => l.feat.sub)
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
  const minSub = Math.min(...subs), maxSub = Math.max(...subs)
  const maxTracks = Math.max(...labels.map((l) => l.tracks), 1)
  const nx = (v: number) => x0 + ((v - minX) / ((maxX - minX) || 1)) * (x1 - x0)
  const ny = (v: number) => y1 - ((v - minY) / ((maxY - minY) || 1)) * (y1 - y0)
  const rOf = (t: number) => 7 + Math.sqrt(t / maxTracks) * 13
  const grid = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 560 }}>
        <rect x={x0} y={y0} width={x1 - x0} height={y1 - y0} fill="var(--surface-2)" fillOpacity={0.22} rx={12} />
        {grid.map((f) => {
          const gx = x0 + f * (x1 - x0), gy = y0 + f * (y1 - y0)
          return (
            <g key={f}>
              <line x1={gx} y1={y0} x2={gx} y2={y1} stroke="var(--line)" strokeOpacity={0.45} strokeDasharray="2 5" />
              <line x1={x0} y1={gy} x2={x1} y2={gy} stroke="var(--line)" strokeOpacity={0.45} strokeDasharray="2 5" />
            </g>
          )
        })}

        {mode === 'feat' ? (
          <>
            <text x={(x0 + x1) / 2} y={H - 18} textAnchor="middle" className="fill-[var(--muted)] text-[13px] font-medium">Brillantezza →</text>
            <text x={x0} y={y1 + 18} textAnchor="start" className="fill-[var(--faint)] text-[10px]">{Math.round(minX)} Hz · dark</text>
            <text x={x1} y={y1 + 18} textAnchor="end" className="fill-[var(--faint)] text-[10px]">{Math.round(maxX)} Hz · bright</text>
            <text x={20} y={(y0 + y1) / 2} textAnchor="middle" transform={`rotate(-90 20 ${(y0 + y1) / 2})`} className="fill-[var(--muted)] text-[13px] font-medium">Percussività →</text>
            <text x={x1 - 8} y={y0 + 15} textAnchor="end" className="fill-[var(--faint)] text-[9px] uppercase tracking-wider">bright · punchy</text>
            <text x={x0 + 8} y={y0 + 15} textAnchor="start" className="fill-[var(--faint)] text-[9px] uppercase tracking-wider">dark · punchy</text>
            <text x={x1 - 8} y={y1 - 8} textAnchor="end" className="fill-[var(--faint)] text-[9px] uppercase tracking-wider">bright · smooth</text>
            <text x={x0 + 8} y={y1 - 8} textAnchor="start" className="fill-[var(--faint)] text-[9px] uppercase tracking-wider">dark · smooth</text>
          </>
        ) : (
          <text x={(x0 + x1) / 2} y={H - 18} textAnchor="middle" className="fill-[var(--muted)] text-[12px]">← le label vicine suonano simili →</text>
        )}

        {pts.map((p) => {
          const cx = nx(p.x), cy = ny(p.y), r = rOf(p.l.tracks)
          const col = subColor(maxSub > minSub ? (p.l.feat.sub - minSub) / (maxSub - minSub) : 0.5)
          const below = cy < (y0 + y1) / 2
          return (
            <g key={p.l.name}>
              <title>{`${p.l.name} — ${p.l.tracks} tracce · brillantezza ${Math.round(p.l.feat.brightness)}Hz · punch ${p.l.feat.punch.toFixed(2)} · sub ${p.l.feat.sub.toFixed(2)} · coerenza ${Math.round(p.l.coherence * 100)}%`}</title>
              <circle cx={cx} cy={cy} r={r} fill={col} fillOpacity={0.2} stroke={col} strokeWidth={1.5} />
              <circle cx={cx} cy={cy} r={2.5} fill={col} />
              <text x={cx} y={below ? cy + r + 13 : cy - r - 7} textAnchor="middle" className="fill-[var(--text)] text-[11px] font-medium">{p.l.name}</text>
            </g>
          )
        })}
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
