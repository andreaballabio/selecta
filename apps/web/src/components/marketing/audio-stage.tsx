'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'

/* HERO "wow": visualizer audio generativo a tutto schermo (canvas reale).
   - campo di onde sonore che fluisce di continuo
   - reagisce al mouse (increspatura) e fa "surge" durante l'analisi
   - tutto lo schermo è dropzone; i risultati galleggiano (niente card)
   Il canvas è JS/rAF: si anima sui browser reali (il preview headless lo congela). */

const MATCHES: [string, number][] = [['Solid Grooves', 94], ['HOTTRAX', 88], ['Repopulate Mars', 81]]
const APPLE = ['#fa233b', '#ff9500', '#34c759', '#0a84ff', '#bf5af2']
type Status = 'idle' | 'run' | 'done'

export function AudioStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: 0.5, y: 0.45 })
  const amp = useRef(1)
  const ampTarget = useRef(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('demo-track.wav')

  // ── motore canvas ──
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0, t = 0
    const LINES = 46

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = () => {
      t += 0.006
      amp.current += (ampTarget.current - amp.current) * 0.06
      const a = amp.current
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      ctx.clearRect(0, 0, w, h)
      const mx = mouse.current.x * w, my = mouse.current.y * h

      for (let i = 0; i < LINES; i++) {
        const norm = i / (LINES - 1)
        const ly = norm * h
        const center = Math.max(0, 1 - Math.abs(norm - 0.5) * 1.5)
        ctx.beginPath()
        for (let x = 0; x <= w; x += 7) {
          const xn = x / w
          let y = ly
            + Math.sin(xn * 6 + t * 1.2 + i * 0.32) * 20 * center * a
            + Math.sin(xn * 13 - t * 0.9 + i * 0.18) * 9 * center * a
            + Math.sin(xn * 24 + t * 1.7) * 3 * center * a
          const dx = x - mx, dy = ly - my
          const d = Math.sqrt(dx * dx + dy * dy)
          y += Math.cos(d * 0.018 - t * 3.2) * Math.max(0, 36 - d * 0.05) * 0.5 * a
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        const accent = i % 9 === 4
        const g = ctx.createLinearGradient(0, 0, w, 0)
        if (accent) {
          const col = APPLE[i % APPLE.length]
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(0.5, col)
          g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.strokeStyle = g
          ctx.shadowBlur = 18
          ctx.shadowColor = col
          ctx.globalAlpha = 0.42 + center * 0.45
          ctx.lineWidth = 1.6
        } else {
          const c = dark ? '255,255,255' : '20,20,20'
          const aMax = (dark ? 0.05 : 0.045) + center * (dark ? 0.18 : 0.13)
          g.addColorStop(0, `rgba(${c},0)`)
          g.addColorStop(0.5, `rgba(${c},${aMax})`)
          g.addColorStop(1, `rgba(${c},0)`)
          ctx.strokeStyle = g
          ctx.shadowBlur = 0
          ctx.globalAlpha = 1
          ctx.lineWidth = 1
        }
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.shadowBlur = 0
      raf = requestAnimationFrame(draw)
    }
    draw() // primo frame sincrono (così è visibile anche se rAF è throttlato)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  const start = (name: string) => {
    setFileName(name); setStatus('run'); ampTarget.current = 2.8
    window.setTimeout(() => { setStatus('done'); ampTarget.current = 1.6 }, 2000)
  }
  const reset = () => { setStatus('idle'); ampTarget.current = 1 }
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }
  }
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files?.[0]
    start(f ? f.name : 'demo-track.wav')
  }
  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) start(f.name) }

  return (
    <section
      onMouseMove={onMove}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); ampTarget.current = 2.6 }}
      onDragEnter={(e) => { e.preventDefault(); setDragging(true); ampTarget.current = 2.6 }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) { setDragging(false); ampTarget.current = 1 } }}
      onDrop={onDrop}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4"
    >
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={onPick} />
      {/* visualizer */}
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* vignettatura per far risaltare il testo */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 42%, transparent 40%, var(--bg) 78%)' }} />
      {/* luce centrale morbida (premium) */}
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(42% 38% at 50% 44%, var(--glass-hi), transparent 70%)', opacity: 0.4 }} />

      {/* ── overlay contenuto ── */}
      <div className="relative z-10 flex w-full max-w-[720px] flex-col items-center text-center">
        {status !== 'done' && (
          <h1 className="font-display display-tight mb-6 text-[3rem] font-semibold leading-[0.92] sm:text-[5.2rem] sm:leading-[0.9]">
            {status === 'run' ? 'Sto ascoltando…' : <>Fatti firmare.<br />Fatti sentire.</>}
          </h1>
        )}
        {status !== 'done' && (
          <p className="mb-10 max-w-md text-lg text-muted">
            {status === 'run'
              ? <>Leggo la firma timbrica di <span className="font-medium text-text">{fileName}</span></>
              : <>Lascia cadere la tua demo <span className="text-text">ovunque sullo schermo</span> — l’AI trova le label che suonano come te.</>}
          </p>
        )}

        {/* IDLE: barra di upload elegante (no cerchio) */}
        {status === 'idle' && (
          <div className="a-in flex w-full flex-col items-center gap-5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="glass glass-hover group flex w-full max-w-[420px] items-center gap-3 rounded-full py-3 pl-3 pr-5 text-left"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-text text-bg transition-transform duration-300 group-hover:scale-105">
                <Upload className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-semibold text-text">Carica la tua demo</span>
                <span className="block text-sm text-faint">trascina o clicca · MP3 · WAV</span>
              </span>
              <ArrowRight className="h-5 w-5 shrink-0 text-muted transition-transform group-hover:translate-x-0.5" />
            </button>
            <button onClick={() => start('demo-track.wav')} className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text">
              <Sparkles className="h-4 w-4" /> oppure prova con una demo
            </button>
          </div>
        )}

        {/* RUN: analisi (no cerchio) */}
        {status === 'run' && (
          <div className="a-in flex flex-col items-center gap-6">
            <span className="flex h-12 items-end gap-1.5">
              {[16, 28, 12, 34, 20, 32, 16].map((h, i) => <span key={i} className="eq-bar w-1.5 rounded-full bg-text" style={{ height: h, animationDelay: `${i * 0.1}s` }} />)}
            </span>
            <div className="h-1 w-72 max-w-[80vw] overflow-hidden rounded-full bg-surface-2">
              <div className="progress-fill h-full rounded-full bg-text" />
            </div>
          </div>
        )}

        {status === 'done' && (
          <>
            <p className="a-in font-mono text-xs uppercase tracking-[0.25em] text-muted">La tua traccia suona come</p>
            <div className="mt-7 flex flex-col items-stretch gap-3">
              {MATCHES.map(([name, pct], i) => (
                <div key={name} className="a-in glass flex w-[340px] max-w-[82vw] items-center gap-4 rounded-2xl px-5 py-3.5" style={{ animationDelay: `${0.08 + i * 0.13}s` }}>
                  <span className="flex-1 text-left font-medium">{name}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2">
                    <div className="bar-grow h-full rounded-full bg-text" style={{ width: `${pct}%`, animationDelay: `${0.2 + i * 0.13}s` }} />
                  </div>
                  <span className="w-10 text-right font-mono text-sm text-muted">{pct}%</span>
                </div>
              ))}
            </div>
            <div className="a-in mt-8 flex items-center gap-3" style={{ animationDelay: '0.5s' }}>
              <button className="group inline-flex items-center gap-2 rounded-full bg-text px-7 py-4 text-[15px] font-semibold text-bg shadow-xl transition-transform hover:scale-[1.03]">
                Carica la tua traccia <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-4 py-4 text-sm text-muted transition-colors hover:text-text">
                <RotateCcw className="h-4 w-4" /> Riprova
              </button>
            </div>
          </>
        )}
      </div>

      {/* overlay drag a tutto schermo */}
      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-text/[0.04] backdrop-blur-sm">
          <div className="glass flex flex-col items-center gap-3 rounded-[28px] px-12 py-10">
            <Upload className="h-8 w-8 text-text" />
            <p className="text-lg font-semibold">Rilascia ovunque per analizzare</p>
          </div>
        </div>
      )}
    </section>
  )
}
