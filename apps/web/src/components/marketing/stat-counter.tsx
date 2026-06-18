'use client'

import { useEffect, useRef, useState } from 'react'

/** Numero che conta verso il valore quando entra nel viewport. */
export function StatCounter({ value, suffix = '', prefix = '' }: { value: number; suffix?: string; prefix?: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [n, setN] = useState(0)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(value); return }
      const start = performance.now()
      const dur = 1100
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / dur)
        const eased = 1 - Math.pow(1 - p, 3)
        setN(Math.round(value * eased))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, { threshold: 0.4 })
    io.observe(el)
    return () => { io.disconnect(); cancelAnimationFrame(raf) }
  }, [value])

  return <span ref={ref} className="tabular-nums">{prefix}{n.toLocaleString('it-IT')}{suffix}</span>
}
