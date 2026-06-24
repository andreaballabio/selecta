'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'

/* Proposte: l'upload INTEGRATO nelle linee reattive dello sfondo.
   variant:
   - 'varco'  → le linee si aprono lasciando un varco a lente al centro
   - 'anello' → alcune linee si avvolgono in un anello d'onda al centro
   - 'firma'  → una linea spessa attraversa il centro (riga della firma)
   - 'solco'  → le linee si infittiscono in una corsia luminosa al centro
   In tutte: niente widget, tutto lo schermo è dropzone, l'onda reagisce. */

export type Variant = 'varco' | 'anello' | 'firma' | 'solco'
const MATCHES: [string, number][] = [['Solid Grooves', 94], ['HOTTRAX', 88], ['Repopulate Mars', 81]]
const APPLE = ['#fa233b', '#ff9500', '#34c759', '#0a84ff', '#bf5af2']
type Status = 'idle' | 'run' | 'done'

const LABELS: Record<Variant, string> = {
  varco: 'Il varco', anello: 'L’anello d’onda', firma: 'La linea della firma', solco: 'Il solco',
}

export function LinesStage({ variant }: { variant: Variant }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: 0.5, y: 0.52 })
  const amp = useRef(1)
  const ampTarget = useRef(1)
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState('demo-track.wav')

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
    resize(); window.addEventListener('resize', resize)

    const draw = () => {
      t += 0.006
      amp.current += (ampTarget.current - amp.current) * 0.06
      const a = amp.current
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      const base = dark ? '255,255,255' : '20,20,20'
      ctx.clearRect(0, 0, w, h)
      const mx = mouse.current.x * w, my = mouse.current.y * h
      const cx = w * 0.5, cy = h * 0.52

      // ── campo di linee orizzontali (con varianti varco/solco) ──
      for (let i = 0; i < LINES; i++) {
        const norm = i / (LINES - 1)
        const ly = norm * h
        const centerB = Math.max(0, 1 - Math.abs(norm - 0.5) * 1.5)
        const inBand = Math.abs(norm - 0.5) < 0.16
        const ampMul = variant === 'solco' && inBand ? 1.7 : 1
        ctx.beginPath()
        for (let x = 0; x <= w; x += 6) {
          const xn = x / w
          let y = ly
            + Math.sin(xn * 6 + t * 1.2 + i * 0.32) * 20 * centerB * a * ampMul
            + Math.sin(xn * 13 - t * 0.9 + i * 0.18) * 9 * centerB * a * ampMul
          const dx = x - mx, dy = ly - my, d = Math.sqrt(dx * dx + dy * dy)
          y += Math.cos(d * 0.018 - t * 3.2) * Math.max(0, 36 - d * 0.05) * 0.5 * a
          if (variant === 'varco') {
            const fx = (x - cx) / (w * 0.22), fy = (ly - cy) / (h * 0.26)
            const dd = Math.sqrt(fx * fx + fy * fy)
            if (dd < 1) y += (ly < cy ? -1 : 1) * (1 - dd) * 95
          }
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        const accent = i % 9 === 4
        const g = ctx.createLinearGradient(0, 0, w, 0)
        if (accent) {
          const col = APPLE[i % APPLE.length]
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, col); g.addColorStop(1, 'rgba(0,0,0,0)')
          ctx.strokeStyle = g; ctx.shadowBlur = 16; ctx.shadowColor = col
          ctx.globalAlpha = (variant === 'anello' ? 0.18 : 0.4) + centerB * 0.42; ctx.lineWidth = 1.5
        } else {
          let amax = (dark ? 0.05 : 0.045) + centerB * (dark ? 0.18 : 0.13)
          if (variant === 'solco' && inBand) amax *= 1.9
          if (variant === 'anello') amax *= 0.5
          g.addColorStop(0, `rgba(${base},0)`); g.addColorStop(0.5, `rgba(${base},${amax})`); g.addColorStop(1, `rgba(${base},0)`)
          ctx.strokeStyle = g; ctx.shadowBlur = (variant === 'solco' && inBand) ? 12 : 0; ctx.shadowColor = dark ? '#fff' : '#000'
          ctx.globalAlpha = 1; ctx.lineWidth = (variant === 'solco' && inBand) ? 1.6 : 1
        }
        ctx.stroke()
      }

      // ── firma: linea spessa al centro ──
      if (variant === 'firma') {
        ctx.beginPath()
        for (let x = 0; x <= w; x += 6) {
          const xn = x / w
          const y = cy + Math.sin(xn * 5 + t * 1.4) * 10 * a + Math.sin(xn * 11 - t) * 4 * a
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
        }
        ctx.strokeStyle = dark ? '#ffffff' : '#141414'; ctx.globalAlpha = 0.92; ctx.lineWidth = 2.4
        ctx.shadowBlur = 18; ctx.shadowColor = dark ? 'rgba(255,255,255,0.55)' : 'rgba(0,0,0,0.3)'; ctx.stroke()
      }

      // ── anello: linee avvolte in cerchio al centro ──
      if (variant === 'anello') {
        const R = Math.min(w, h) * 0.19
        for (let k = 0; k < 6; k++) {
          const rr = R + k * 7
          ctx.beginPath()
          for (let ang = 0; ang <= Math.PI * 2 + 0.07; ang += 0.06) {
            const wob = Math.sin(ang * 6 + t * 1.6 + k * 0.6) * (5 + 3 * Math.sin(t + k)) * a + Math.sin(ang * 3 - t * 1.1) * 4 * a
            const r = rr + wob
            const x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r
            if (ang === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
          }
          const accent = k % 3 === 1
          if (accent) { const col = APPLE[(k * 2) % APPLE.length]; ctx.strokeStyle = col; ctx.shadowBlur = 16; ctx.shadowColor = col; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.5 }
          else { ctx.strokeStyle = dark ? '#ffffff' : '#141414'; ctx.shadowBlur = 0; ctx.globalAlpha = 0.14 + (6 - k) * 0.03; ctx.lineWidth = 1 }
          ctx.stroke()
        }
      }

      ctx.globalAlpha = 1; ctx.shadowBlur = 0
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [variant])

  const start = (name: string) => { setFileName(name); setStatus('run'); ampTarget.current = 2.8; window.setTimeout(() => { setStatus('done'); ampTarget.current = 1.6 }, 1900) }
  const reset = () => { setStatus('idle'); ampTarget.current = 1 }
  const onMove = (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height } }
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files?.[0]; start(f ? f.name : 'demo-track.wav') }
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
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(120% 80% at 50% 44%, transparent 42%, var(--bg) 82%)' }} />

      {/* etichetta proposta (solo per il confronto) */}
      <span className="absolute left-1/2 top-20 -translate-x-1/2 font-mono text-xs uppercase tracking-[0.25em] text-faint">{LABELS[variant]}</span>

      <div className="relative z-10 flex w-full max-w-[680px] flex-col items-center text-center">
        {status !== 'done' && (
          <h1 className="font-display display-tight mb-10 text-[2.6rem] font-semibold leading-[0.92] sm:text-[4.4rem] sm:leading-[0.9]">
            {status === 'run' ? 'Sto ascoltando…' : <>Fatti firmare.<br />Fatti sentire.</>}
          </h1>
        )}

        {status === 'idle' && (
          <div className="a-in flex flex-col items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} className="group inline-flex items-center gap-2.5 text-text">
              <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" />
              <span className="text-xl font-semibold">{variant === 'firma' ? 'Trascina qui per farti firmare' : 'Trascina la tua demo'}</span>
            </button>
            <span className="text-sm text-faint">o clicca · MP3 · WAV</span>
            <button onClick={() => start('demo-track.wav')} className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text">
              <Sparkles className="h-4 w-4" /> oppure prova con una demo
            </button>
          </div>
        )}

        {status === 'run' && (
          <div className="a-in flex flex-col items-center gap-6">
            <span className="flex h-12 items-end gap-1.5">
              {[16, 28, 12, 34, 20, 32, 16].map((hh, i) => <span key={i} className="eq-bar w-1.5 rounded-full bg-text" style={{ height: hh, animationDelay: `${i * 0.1}s` }} />)}
            </span>
            <span className="text-sm text-muted">Leggo <span className="font-medium text-text">{fileName}</span></span>
          </div>
        )}

        {status === 'done' && (
          <>
            <p className="a-in font-mono text-xs uppercase tracking-[0.25em] text-muted">La tua traccia suona come</p>
            <div className="mt-7 flex flex-col items-stretch gap-3">
              {MATCHES.map(([name, pct], i) => (
                <div key={name} className="a-in glass flex w-[340px] max-w-[82vw] items-center gap-4 rounded-2xl px-5 py-3.5" style={{ animationDelay: `${0.08 + i * 0.13}s` }}>
                  <span className="flex-1 text-left font-medium">{name}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2"><div className="bar-grow h-full rounded-full bg-text" style={{ width: `${pct}%`, animationDelay: `${0.2 + i * 0.13}s` }} /></div>
                  <span className="w-10 text-right font-mono text-sm text-muted">{pct}%</span>
                </div>
              ))}
            </div>
            <div className="a-in mt-8 flex items-center gap-3" style={{ animationDelay: '0.5s' }}>
              <button className="group inline-flex items-center gap-2 rounded-full bg-text px-7 py-4 text-[15px] font-semibold text-bg shadow-xl transition-transform hover:scale-[1.03]">Carica la tua traccia <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
              <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-4 py-4 text-sm text-muted transition-colors hover:text-text"><RotateCcw className="h-4 w-4" /> Riprova</button>
            </div>
          </>
        )}
      </div>

      {dragging && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-text/[0.04] backdrop-blur-sm">
          <p className="text-lg font-semibold">Rilascia ovunque per analizzare</p>
        </div>
      )}
    </section>
  )
}
