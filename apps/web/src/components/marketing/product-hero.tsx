'use client'

import { useRef, useState } from 'react'
import { Sparkles, Play, Pause, Download, Upload } from 'lucide-react'
import { PreviewNav } from '@/components/marketing/preview-nav'

/* Direzione 2 — "Il prodotto come hero", sviluppata:
   sinistra super pulita; destra = finestra del prodotto INTUITIVA e REATTIVA
   (tilt che segue il mouse, righe cliccabili, play, match che si compila). */

const WAVE = Array.from({ length: 64 }, (_, i) => Math.round(16 + Math.abs(Math.sin(i * 0.5) * 0.5 + Math.sin(i * 0.17) * 0.32 + Math.cos(i * 0.09) * 0.2) * 82))
const TRACKS = [
  { t: 'Nightshift', a: 'Lautaro Vela', k: '8A', b: 126 },
  { t: 'Pressure Drop', a: 'MONA', k: '5A', b: 125 },
  { t: 'Concrete', a: 'D. Ferraro', k: '11B', b: 124 },
]
const MATCH: [string, number][] = [['Solid Grooves', 94], ['HOTTRAX', 88], ['Repopulate Mars', 81]]
type Phase = 'idle' | 'run' | 'done'

function MiniWave({ frac, n, animate = false }: { frac: number; n: number; animate?: boolean }) {
  return (
    <div className="flex h-6 items-center gap-[2px]">
      {WAVE.slice(0, n).map((v, i) => {
        const played = i / n < frac
        return <span key={i} className={`w-[2px] flex-1 rounded-full ${animate && played ? 'eq-bar' : ''}`} style={{ height: `${v}%`, background: played ? 'var(--color-text)' : 'var(--color-wave)', animationDelay: `${(i % 8) * 0.1}s` }} />
      })}
    </div>
  )
}

export function ProductHero() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [attempt, setAttempt] = useState(0)
  const [current, setCurrent] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  const analyze = () => { setPhase('run'); window.setTimeout(() => { setPhase('done'); setAttempt((a) => a + 1) }, 1500) }
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); analyze() }
  const tilt = (e: React.MouseEvent) => {
    const el = cardRef.current; if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--ry', `${((e.clientX - r.left) / r.width - 0.5) * 11}deg`)
    el.style.setProperty('--rx', `${-((e.clientY - r.top) / r.height - 0.5) * 9}deg`)
  }
  const tiltReset = () => { const el = cardRef.current; if (el) { el.style.setProperty('--ry', '-8deg'); el.style.setProperty('--rx', '2deg') } }

  const done = phase === 'done'
  const tr = TRACKS[current]

  return (
    <section
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={onDrop}
      className="relative min-h-screen overflow-hidden bg-bg text-text"
    >
      <PreviewNav />
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={analyze} />
      <div aria-hidden className="pointer-events-none absolute right-[-8%] top-1/4 h-[42rem] w-[42rem] rounded-full blur-[130px]" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 20%, transparent), transparent 70%)', opacity: 0.45 }} />

      <div className="mx-auto grid min-h-screen max-w-7xl items-center gap-14 px-6 pt-28 pb-16 lg:grid-cols-[0.85fr_1.15fr]">
        {/* ── SINISTRA: essenziale ── */}
        <div>
          <h1 className="a-in font-display display-tight text-[3rem] font-semibold leading-[0.9] sm:text-[5rem] sm:leading-[0.88]">
            Fatti firmare.<br />Fatti sentire.
          </h1>
          <p className="a-in mt-7 max-w-sm text-lg leading-relaxed text-muted" style={{ animationDelay: '0.1s' }}>
            Carica la demo. In 30 secondi scopri quali label suonano come te.
          </p>
          <div className="a-in mt-9 flex items-center gap-5" style={{ animationDelay: '0.18s' }}>
            <button onClick={() => inputRef.current?.click()} className="group inline-flex items-center gap-2 rounded-full bg-text px-7 py-4 text-[15px] font-semibold text-bg shadow-xl transition-transform hover:scale-[1.03]">
              <Upload className="h-4 w-4" /> Carica la tua demo
            </button>
            <button onClick={analyze} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text">
              <Sparkles className="h-4 w-4" /> prova una demo
            </button>
          </div>
        </div>

        {/* ── DESTRA: finestra prodotto, intuitiva e reattiva ── */}
        <div className="a-in [perspective:1800px]" style={{ animationDelay: '0.22s' }}>
          <div
            ref={cardRef}
            onMouseMove={tilt}
            onMouseLeave={tiltReset}
            className="glass rounded-[26px] p-2.5 shadow-2xl"
            style={{ transform: 'rotateX(var(--rx,2deg)) rotateY(var(--ry,-8deg))', transition: 'transform 0.18s ease-out' }}
          >
            {/* now playing */}
            <div className="glass mb-2.5 flex items-center gap-3 rounded-2xl p-3">
              <div className="flex h-12 w-12 shrink-0 items-end justify-center gap-[2px] rounded-xl p-2.5" style={{ background: 'linear-gradient(145deg,#fa233b,#bf5af2)' }}>
                {[9, 15, 7, 12].map((h, i) => <span key={i} className={playing ? 'eq-bar w-1 rounded-full bg-white' : 'w-1 rounded-full bg-white/70'} style={{ height: h, animationDelay: `${i * 0.12}s` }} />)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{tr.t}</p>
                <p className="truncate text-xs text-muted">{tr.a}</p>
              </div>
              <div className="hidden w-32 sm:block"><MiniWave frac={0.45} n={38} animate={playing} /></div>
              <button onClick={() => setPlaying((p) => !p)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text text-bg transition-transform hover:scale-105">
                {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-px" />}
              </button>
            </div>

            {/* catalogo cliccabile */}
            <div className="glass rounded-2xl p-1.5">
              {TRACKS.map((row, i) => (
                <button
                  key={row.t}
                  onClick={() => { setCurrent(i); setPlaying(true) }}
                  className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left transition-colors ${current === i ? 'bg-text/[0.07]' : 'hover:bg-text/[0.04]'}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted">
                    {current === i && playing ? <Pause className="h-4 w-4 text-text" /> : <Play className="h-4 w-4 translate-x-px" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{row.t}</span><span className="block truncate text-xs text-muted">{row.a}</span></span>
                  <span className="hidden font-mono text-xs text-muted sm:block">{row.k}</span>
                  <span className="hidden w-9 text-right font-mono text-xs text-muted sm:block">{row.b}</span>
                  <Download className="h-4 w-4 shrink-0 text-faint" />
                </button>
              ))}
            </div>

            {/* match: si compila */}
            <div className="glass relative mt-2.5 overflow-hidden rounded-2xl p-4">
              <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">{done ? 'La tua traccia suona come' : 'Match con le label'}</p>
              <div key={attempt} className="space-y-2.5">
                {MATCH.map(([n, p], i) => (
                  <div key={n}>
                    <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{n}</span><span className="font-mono text-muted">{p}%</span></div>
                    <div className="h-1.5 w-full rounded-full bg-surface-2"><div className="bar-grow h-full rounded-full bg-text" style={{ width: `${p}%`, animationDelay: `${0.1 + i * 0.12}s` }} /></div>
                  </div>
                ))}
              </div>
              {phase === 'run' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-bg/75 backdrop-blur-sm">
                  <span className="flex h-8 items-end gap-1">{[12, 22, 10, 26, 16].map((h, i) => <span key={i} className="eq-bar w-1 rounded-full bg-text" style={{ height: h, animationDelay: `${i * 0.1}s` }} />)}</span>
                  <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted">Analizzo la firma timbrica…</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {dragging && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-text/[0.04] backdrop-blur-sm">
          <div className="glass flex items-center gap-3 rounded-full px-8 py-5"><Upload className="h-6 w-6" /><p className="text-lg font-semibold">Rilascia per analizzare</p></div>
        </div>
      )}
    </section>
  )
}
