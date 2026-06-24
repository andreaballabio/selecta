'use client'

import type { CSSProperties } from 'react'
import { ChevronDown } from 'lucide-react'
import { Analyzer } from './analyzer'

/* Hero full-screen, scenico e interattivo:
   - blob di colore (Apple) che fluttuano + parallax al mouse
   - griglia tech sfumata
   - luce che segue il cursore
   - spettro audio animato in basso
   - analizzatore al centro con tilt 3D al cursore
   Le animazioni d'ambiente sono CSS; l'interazione col mouse aggiorna
   variabili CSS (--mx/--my/--px/--py/--rx/--ry) sul contenitore. */

// spettro deterministico (niente mismatch di hydration)
const SPECTRUM = Array.from({ length: 80 }, (_, i) => {
  const v = Math.abs(Math.sin(i * 0.4) * 0.5 + Math.sin(i * 0.13) * 0.3 + Math.cos(i * 0.07) * 0.2)
  return Math.round(12 + Math.min(1, v) * 78)
})

function Blob({ className, color, drift }: { className: string; color: string; drift: string }) {
  return (
    <div className={`absolute ${className}`} style={{ transform: 'translate(var(--px), var(--py))' }}>
      <div className={`${drift} h-[34rem] w-[34rem] rounded-full blur-[120px]`} style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }} />
    </div>
  )
}

export function HeroStage() {
  const onMove = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    const r = el.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    el.style.setProperty('--mx', `${(x * 100).toFixed(2)}%`)
    el.style.setProperty('--my', `${(y * 100).toFixed(2)}%`)
    el.style.setProperty('--px', `${((x - 0.5) * 36).toFixed(1)}px`)
    el.style.setProperty('--py', `${((y - 0.5) * 36).toFixed(1)}px`)
    el.style.setProperty('--rx', `${((0.5 - y) * 5).toFixed(2)}deg`)
    el.style.setProperty('--ry', `${((x - 0.5) * 5).toFixed(2)}deg`)
  }
  const reset = (e: React.MouseEvent<HTMLElement>) => {
    const el = e.currentTarget
    ;['--px', '--py'].forEach((p) => el.style.setProperty(p, '0px'))
    ;['--rx', '--ry'].forEach((p) => el.style.setProperty(p, '0deg'))
  }

  const vars = { '--mx': '50%', '--my': '40%', '--px': '0px', '--py': '0px', '--rx': '0deg', '--ry': '0deg' } as CSSProperties

  return (
    <section
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={vars}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pb-16 pt-24"
    >
      {/* blob colorati (parallax + drift) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <Blob className="left-[6%] top-[12%]" color="#0a84ff55" drift="drift-a" />
        <Blob className="right-[2%] top-[22%]" color="#bf5af24d" drift="drift-b" />
        <Blob className="bottom-[2%] left-[26%]" color="#34c75944" drift="drift-c" />
        <Blob className="right-[20%] bottom-[12%]" color="#fa233b3d" drift="drift-a" />
      </div>

      {/* griglia tech sfumata */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.05]"
        style={{
          backgroundImage: 'linear-gradient(var(--color-text) 1px, transparent 1px), linear-gradient(90deg, var(--color-text) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
          maskImage: 'radial-gradient(circle at center, #000 25%, transparent 72%)',
          WebkitMaskImage: 'radial-gradient(circle at center, #000 25%, transparent 72%)',
        }}
      />

      {/* luce che segue il cursore */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ background: 'radial-gradient(560px circle at var(--mx) var(--my), var(--glass-hi), transparent 60%)', opacity: 0.5 }}
      />

      {/* spettro audio in basso */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 flex h-48 items-end justify-center gap-[3px] px-2 opacity-[0.28]">
        {SPECTRUM.map((h, i) => (
          <span key={i} className="eq-bar w-1.5 max-w-[10px] flex-1 rounded-t-full bg-text" style={{ height: `${h}%`, animationDelay: `${(i % 16) * 0.08}s`, animationDuration: `${1.2 + (i % 5) * 0.2}s` }} />
        ))}
      </div>

      {/* contenuto */}
      <div className="relative z-10 flex w-full max-w-[600px] flex-col items-center text-center">
        <div className="glass mb-7 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-sm text-muted">
          <span className="h-2 w-2 rounded-full" style={{ background: 'conic-gradient(from 0deg, #fa233b, #ff9500, #34c759, #0a84ff, #bf5af2, #fa233b)' }} />
          A&amp;R AI per la tech house
        </div>
        <h1 className="font-display display-tight text-[2.7rem] font-semibold leading-[1.0] sm:text-[4.4rem] sm:leading-[0.95]">
          Quali label suonano come te?
        </h1>
        <p className="mt-4 text-lg text-muted">Trascina la tua traccia. In 30 secondi lo sai.</p>

        <div className="mt-9 w-full" style={{ transform: 'perspective(1200px) rotateX(var(--rx)) rotateY(var(--ry))', transformStyle: 'preserve-3d' }}>
          <Analyzer />
        </div>
      </div>

      {/* scroll cue */}
      <div className="pointer-events-none absolute bottom-7 left-1/2 -translate-x-1/2">
        <ChevronDown className="bob h-6 w-6 text-faint" />
      </div>
    </section>
  )
}
