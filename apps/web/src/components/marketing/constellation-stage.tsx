'use client'

import { useEffect, useRef, useState } from 'react'
import { Upload, ArrowRight, RotateCcw, Sparkles } from 'lucide-react'

/* HERO "Costellazione" — rete neurale viva: nodi su un guscio 3D con leggero
   sway (niente spin/rotazione col mouse), legami che si formano e si disgregano
   nel tempo e si accendono dove passa il cursore. Upload = drag&drop ovunque:
   trascinando un file la rete si STRINGE verso il centro (feedback), al rilascio
   si compatta + lampo → risultati. Le label affiorano su nodi fissi. */

const APPLE = ['#fa233b', '#ff9500', '#34c759', '#0a84ff', '#bf5af2']
const LABELS = ['Solid Grooves', 'HOTTRAX', 'Repopulate Mars', 'Cuttin’ Headz', 'NoZzo', 'Diynamic', 'Mindshake', 'CircoLoco', 'Hot Creations', 'Toolroom']
const MATCH: [string, number][] = [['Solid Grooves', 94], ['HOTTRAX', 88], ['Repopulate Mars', 81]]
const BARS = [12, 22, 30, 18, 26, 14, 22] // altezze barre equalizer (segnale audio)
type Phase = 'idle' | 'run' | 'done'
const hx = (h: string): [number, number, number] => { const x = h.replace('#', ''); return [parseInt(x.slice(0, 2), 16) || 0, parseInt(x.slice(2, 4), 16) || 0, parseInt(x.slice(4, 6), 16) || 0] }
const ca = (h: string, a: number) => { const [r, g, b] = hx(h); return `rgba(${r},${g},${b},${a})` }
const cl = (h: string, a: number, amt = 0.45) => { const [r, g, b] = hx(h); const m = (c: number) => Math.round(c + (255 - c) * amt); return `rgba(${m(r)},${m(g)},${m(b)},${a})` }

export function ConstellationStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const mouse = useRef({ x: 0.5, y: 0.5, active: false })
  const gather = useRef(0)
  const gatherTarget = useRef(0)
  const rot = useRef({ x: 0.16, y: 0 })
  const inputRef = useRef<HTMLInputElement>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    let w = 0, h = 0, raf = 0, t = 0
    const N = 140
    type P = { ox: number; oy: number; oz: number; x: number; y: number; vx: number; vy: number; z: number; col: string | null; ph: number }
    let parts: P[] = []
    let edges: [number, number][] = []
    const labelIdx: Record<string, number> = {}
    const labelCol: Record<string, string> = {}
    const FOCAL = 760

    const init = () => {
      parts = []
      const R = Math.min(w, h) * 0.46
      for (let i = 0; i < N; i++) {
        const u = Math.random(), v = Math.random()
        const theta = Math.acos(2 * u - 1), phi = 2 * Math.PI * v
        const rr = R * (0.62 + 0.38 * Math.random())
        const ox = Math.sin(theta) * Math.cos(phi) * rr * 1.5
        const oy = Math.sin(theta) * Math.sin(phi) * rr
        const oz = Math.cos(theta) * rr
        const col = Math.random() < 0.12 ? APPLE[i % APPLE.length] : null
        parts.push({ ox, oy, oz, x: w / 2 + ox * 0.6, y: h / 2 + oy * 0.6, vx: 0, vy: 0, z: 0, col, ph: Math.random() * Math.PI * 2 })
      }
      // reticolo STABILE: ogni nodo collegato ai 3 più vicini in 3D
      edges = []
      const seen = new Set<string>()
      for (let i = 0; i < N; i++) {
        const di: { j: number; d: number }[] = []
        for (let j = 0; j < N; j++) { if (j === i) continue; const dx = parts[i].ox - parts[j].ox, dy = parts[i].oy - parts[j].oy, dz = parts[i].oz - parts[j].oz; di.push({ j, d: dx * dx + dy * dy + dz * dz }) }
        di.sort((p, q) => p.d - q.d)
        for (let k = 0; k < 3; k++) { const j = di[k].j; const key = i < j ? `${i}_${j}` : `${j}_${i}`; if (!seen.has(key)) { seen.add(key); edges.push([i, j]) } }
      }
      LABELS.forEach((l, k) => { labelIdx[l] = (k * 13 + 7) % N; labelCol[l] = APPLE[k % APPLE.length] })
    }
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth; h = canvas.clientHeight
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); init()
    }
    resize(); window.addEventListener('resize', resize)
    const startMs = performance.now()
    type Lab = { text: string; born: number }
    let labs: Lab[] = []
    let nextSpawn = 0

    const draw = () => {
      t += 0.01
      gather.current += (gatherTarget.current - gather.current) * 0.07
      const g = gather.current
      const dark = document.documentElement.getAttribute('data-theme') === 'dark'
      const base = dark ? '255,255,255' : '20,20,20'
      const cx = w / 2, cy = h * 0.5
      const intro = Math.min(1, (performance.now() - startMs) / 1200)
      const introS = (0.4 + intro * (2 - intro) * 0.6) * (1 - g * 0.85) // si stringe verso il centro col gather
      // orientamento: leggero "sway" autonomo (niente spin, niente rotazione col mouse)
      const tRotY = Math.sin(t * 0.11) * 0.5
      const tRotX = 0.2 + Math.cos(t * 0.085) * 0.13
      rot.current.y += (tRotY - rot.current.y) * 0.04
      rot.current.x += (tRotX - rot.current.x) * 0.04
      const cY = Math.cos(rot.current.y), sY = Math.sin(rot.current.y)
      const cX = Math.cos(rot.current.x), sX = Math.sin(rot.current.x)
      ctx.clearRect(0, 0, w, h)

      for (const p of parts) {
        const s = 1 + Math.sin(t * 0.6 + p.ph) * 0.05 // respiro 3D per-nodo → meno statico
        const ox = p.ox * s, oy = p.oy * s, oz = p.oz * s
        const X1 = ox * cY - oz * sY
        const Z1 = ox * sY + oz * cY
        const Y2 = oy * cX - Z1 * sX
        const Z2 = oy * sX + Z1 * cX
        const persp = FOCAL / (FOCAL + Z2)
        const tx = cx + X1 * persp * introS
        const ty = cy + Y2 * persp * introS
        p.z = Z2
        p.vx += (tx - p.x) * 0.16; p.vy += (ty - p.y) * 0.16
        p.vx *= 0.74; p.vy *= 0.74; p.x += p.vx; p.y += p.vy
      }

      const order = parts.map((_, i) => i).sort((a, b) => parts[b].z - parts[a].z)
      const mx = mouse.current.x * w, my = mouse.current.y * h, mAct = mouse.current.active
      const GLOW = 260
      const Rz = Math.min(w, h) * 0.46
      const lineMin = dark ? 0.04 : 0.035, lineSpan = dark ? 0.42 : 0.36

      // legami evolutivi (si formano/disgregano) + reazione al cursore (scia)
      let ei = 0
      for (const [i, j] of edges) {
        const e = ei++
        const a = parts[i], b = parts[j]
        const depth = Math.min(1, Math.max(0, (Rz - (a.z + b.z) / 2) / (2 * Rz)))
        const sp = 0.05 + (e % 7) * 0.011
        const cyc = ((t * sp + e * 0.7) % 1 + 1) % 1
        const env = cyc < 0.18 ? cyc / 0.18 : cyc < 0.62 ? 1 : cyc < 0.82 ? 1 - (cyc - 0.62) / 0.2 : 0
        let al = (lineMin + depth * lineSpan) * env * (1 + g)
        let lw = 0.4 + depth * 0.6
        if (mAct) { const md = Math.hypot(mx - (a.x + b.x) / 2, my - (a.y + b.y) / 2); if (md < GLOW) { const k = 1 - md / GLOW; al += k * k * 0.6; lw += k * 1.3 } }
        if (al < 0.012) continue
        ctx.strokeStyle = `rgba(${base},${al})`; ctx.lineWidth = lw
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
      }
      // nodi (dal più lontano al più vicino)
      for (const i of order) {
        const p = parts[i]
        const persp = FOCAL / (FOCAL + p.z)
        const depth = Math.min(1, Math.max(0, (Rz - p.z) / (2 * Rz)))
        const near = mAct ? Math.max(0, 1 - Math.hypot(mx - p.x, my - p.y) / GLOW) : 0
        const r = (p.col ? 2.6 : 1.9) * Math.min(2.4, persp) * (0.55 + depth * 0.7) * (1 + g * 0.45 + near * 1.2)
        const da = Math.min(1, (dark ? 0.2 : 0.24) + depth * 0.82 + near * 0.3)
        ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.4, r), 0, Math.PI * 2)
        if (p.col) { ctx.fillStyle = p.col; ctx.shadowBlur = 9 + g * 16 + near * 14 + depth * 7; ctx.shadowColor = p.col; ctx.globalAlpha = da }
        else { ctx.fillStyle = `rgba(${base},1)`; ctx.shadowBlur = near * 10; ctx.shadowColor = dark ? '#fff' : '#000'; ctx.globalAlpha = da }
        ctx.fill()
      }
      ctx.globalAlpha = 1; ctx.shadowBlur = 0

      // ── label (nodo fisso, niente duplicati) ──
      const now = performance.now()
      if (g < 0.2 && now > nextSpawn && labs.length < 3) {
        const free = LABELS.filter((l) => !labs.some((x) => x.text === l) && parts[labelIdx[l]].z < -20)
        if (free.length) { labs.push({ text: free[Math.floor(Math.random() * free.length)], born: now }); nextSpawn = now + 1300 + Math.random() * 1500 }
        else nextSpawn = now + 400
      }
      labs = labs.filter((l) => now - l.born < 4600)
      for (const l of labs) {
        const p = parts[labelIdx[l.text]]
        const age = now - l.born
        const env = Math.min(1, age / 500) * Math.min(1, (4600 - age) / 900)
        const depthFade = Math.min(1, Math.max(0, (-p.z - 5) / 120))
        const a = env * depthFade * (1 - g)
        if (a <= 0.03) continue
        const col = labelCol[l.text]
        const aff = 80 + (labelIdx[l.text] * 7) % 18

        const ringT = (age % 1700) / 1700
        ctx.beginPath(); ctx.arc(p.x, p.y, 4 + ringT * 28, 0, Math.PI * 2)
        ctx.strokeStyle = ca(col, (1 - ringT) * 0.55 * a); ctx.lineWidth = 2 * (1 - ringT) + 0.3; ctx.stroke()
        ctx.beginPath(); ctx.arc(p.x, p.y, 4.5, 0, Math.PI * 2); ctx.fillStyle = ca(col, a); ctx.shadowBlur = 16 * a; ctx.shadowColor = col; ctx.fill(); ctx.shadowBlur = 0

        ctx.font = '700 14px system-ui, -apple-system, sans-serif'
        const tw = ctx.measureText(l.text).width
        const avR = 13, padL = 8, gap = 11, padR = 16, ph = 50
        const pw = padL + avR * 2 + gap + Math.max(tw, 72) + padR
        const bx = p.x + 22, by = p.y - ph / 2
        const cxp = bx + pw / 2, cyp = by + ph / 2

        ctx.strokeStyle = ca(col, 0.5 * a); ctx.lineWidth = 1.3
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(bx, cyp); ctx.stroke()

        ctx.save()
        const s = 0.88 + Math.min(1, age / 380) * 0.12
        ctx.translate(cxp, cyp); ctx.scale(s, s); ctx.translate(-cxp, -cyp)
        ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(bx, by, pw, ph, 17); else ctx.rect(bx, by, pw, ph)
        ctx.fillStyle = dark ? `rgba(18,18,22,${0.95 * a})` : `rgba(255,255,255,${0.97 * a})`
        ctx.shadowBlur = 28 * a; ctx.shadowColor = ca(col, 0.55 * a); ctx.fill()
        ctx.shadowBlur = 0; ctx.strokeStyle = ca(col, 0.45 * a); ctx.lineWidth = 1.2; ctx.stroke()
        const acx = bx + padL + avR, acy = by + ph / 2
        const grd = ctx.createLinearGradient(acx - avR, acy - avR, acx + avR, acy + avR)
        grd.addColorStop(0, cl(col, a, 0.25)); grd.addColorStop(1, ca(col, a))
        ctx.beginPath(); ctx.arc(acx, acy, avR, 0, Math.PI * 2); ctx.fillStyle = grd; ctx.shadowBlur = 10 * a; ctx.shadowColor = ca(col, 0.6 * a); ctx.fill(); ctx.shadowBlur = 0
        ctx.fillStyle = `rgba(255,255,255,${a})`; ctx.font = '800 13px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(l.text[0], acx, acy + 0.5)
        const tx = bx + padL + avR * 2 + gap
        ctx.textAlign = 'left'
        ctx.font = '700 14px system-ui, -apple-system, sans-serif'; ctx.fillStyle = dark ? `rgba(255,255,255,${a})` : `rgba(20,20,20,${a})`
        ctx.fillText(l.text, tx, acy - 6)
        ctx.font = '600 11px system-ui, sans-serif'; ctx.fillStyle = ca(col, a)
        ctx.fillText(`${aff}% affine`, tx, acy + 9)
        ctx.restore()
        ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'
      }

      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize) }
  }, [])

  const analyze = () => { setPhase('run'); gatherTarget.current = 0.85; window.setTimeout(() => { setPhase('done'); gatherTarget.current = 0.12 }, 1700) }
  const reset = () => { setPhase('idle'); gatherTarget.current = 0 }
  const onMove = (e: React.MouseEvent<HTMLElement>) => { const r = e.currentTarget.getBoundingClientRect(); mouse.current = { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height, active: true } }
  const onLeave = () => { mouse.current.active = false }
  // drag&drop: trascinando un file la rete si stringe verso il centro (feedback)
  const onDragIn = (e: React.DragEvent) => { e.preventDefault(); setDragging(true); if (phase === 'idle') gatherTarget.current = 0.28 }
  const onDragOut = (e: React.DragEvent) => { if (e.currentTarget === e.target) { setDragging(false); if (phase === 'idle') gatherTarget.current = 0 } }
  const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); analyze() }

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      onDragOver={onDragIn}
      onDragEnter={onDragIn}
      onDragLeave={onDragOut}
      onDrop={onDrop}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 text-text"
    >
      <input ref={inputRef} type="file" accept="audio/*" className="hidden" onChange={analyze} />
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(46% 40% at 50% 50%, color-mix(in srgb, var(--bg) 58%, transparent), transparent 74%)' }} />
      {phase === 'run' && (
        <div aria-hidden className="flash pointer-events-none absolute left-1/2 top-1/2 z-[5] h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: 'radial-gradient(circle, var(--glass-hi), transparent 62%)' }} />
      )}

      <div className="relative z-10 flex w-full max-w-[680px] flex-col items-center text-center">
        {phase === 'idle' && (
          <span className="a-in mb-6 inline-flex items-center gap-2 rounded-full glass px-4 py-1.5 text-xs font-medium text-muted">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-text/40" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-text" />
            </span>
            A&R AI · dal suono alle label giuste
          </span>
        )}
        {phase !== 'done' && (
          <h1 className="font-display display-tight mb-5 text-[3rem] font-semibold leading-[0.9] sm:text-[5.4rem] sm:leading-[0.88]">
            {phase === 'run' ? 'Sto ascoltando…' : <>Fatti firmare.<br />Fatti sentire.</>}
          </h1>
        )}
        {phase === 'idle' && (
          <>
            <p className="a-in mb-8 max-w-[34ch] text-balance text-lg text-muted sm:text-xl">
              Carica una traccia: l’AI legge il tuo <span className="font-medium text-text">suono</span> e trova le <span className="font-medium text-text">etichette</span> che possono firmarti.
            </p>
            {/* DROPZONE drag&drop — frosted, integrata nella rete, reattiva al trascinamento */}
            <div className="a-in relative w-full max-w-[430px]">
              <span aria-hidden className="pointer-events-none absolute -inset-2 -z-10 rounded-[32px] opacity-70 blur-2xl animate-pulse" style={{ background: 'radial-gradient(60% 60% at 50% 50%, var(--glass-hi), transparent 70%)' }} />
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                aria-label="Carica o trascina una traccia audio"
                className={`group relative flex w-full flex-col items-center gap-2.5 overflow-hidden rounded-[28px] border border-dashed px-8 py-8 backdrop-blur-xl transition-all duration-300 ${dragging ? 'scale-[1.03] border-text bg-surface/60' : 'border-line bg-surface/25 hover:-translate-y-0.5 hover:border-faint hover:bg-surface/45'}`}
              >
                <span aria-hidden className="flex h-8 items-end gap-[3px]">
                  {BARS.map((hh, i) => (
                    <span key={i} className="eq-bar w-[3px] rounded-full bg-text/75" style={{ height: hh, animationDelay: `${i * 0.09}s` }} />
                  ))}
                </span>
                <span className="flex items-center gap-2 text-lg font-semibold">
                  <Upload className="h-5 w-5 transition-transform group-hover:-translate-y-0.5" /> {dragging ? 'Rilascia per analizzare' : 'Trascina la tua traccia'}
                </span>
                <span className="text-sm text-faint">o scegli un file · MP3 · WAV</span>
              </button>
            </div>
            <button onClick={analyze} className="a-in mt-7 inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text"><Sparkles className="h-4 w-4" /> oppure prova con una demo</button>
          </>
        )}
        {phase === 'run' && <p className="a-in font-mono text-sm uppercase tracking-[0.2em] text-muted">Leggo la firma timbrica…</p>}
        {phase === 'done' && (
          <>
            <p className="a-in font-mono text-xs uppercase tracking-[0.25em] text-muted">La tua traccia suona come</p>
            <div className="mt-7 flex flex-col items-stretch gap-3">
              {MATCH.map(([n, p], i) => (
                <div key={n} className="a-in glass flex w-[340px] max-w-[82vw] items-center gap-4 rounded-2xl px-5 py-3.5" style={{ animationDelay: `${0.08 + i * 0.13}s` }}>
                  <span className="flex-1 text-left font-medium">{n}</span>
                  <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-2"><div className="bar-grow h-full rounded-full bg-text" style={{ width: `${p}%`, animationDelay: `${0.2 + i * 0.13}s` }} /></div>
                  <span className="w-10 text-right font-mono text-sm text-muted">{p}%</span>
                </div>
              ))}
            </div>
            <div className="a-in mt-8 flex items-center gap-3" style={{ animationDelay: '0.5s' }}>
              <button type="button" onClick={() => inputRef.current?.click()} className="group inline-flex items-center gap-2 rounded-full bg-text px-7 py-4 text-[15px] font-semibold text-bg shadow-xl transition-transform hover:scale-[1.03]">Carica la tua traccia <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></button>
              <button onClick={reset} className="inline-flex items-center gap-1.5 rounded-full px-4 py-4 text-sm text-muted transition-colors hover:text-text"><RotateCcw className="h-4 w-4" /> Riprova</button>
            </div>
          </>
        )}
      </div>

      {dragging && (
        <div aria-hidden className="pointer-events-none absolute inset-0 z-[5] bg-text/[0.04] backdrop-blur-[2px]" />
      )}
    </section>
  )
}
