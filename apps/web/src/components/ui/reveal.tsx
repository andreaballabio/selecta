'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * Rivela il contenuto con una transizione morbida quando entra nel viewport.
 * `delay` in ms per effetto a cascata. Rispetta prefers-reduced-motion (CSS).
 */
export function Reveal({
  children, delay = 0, className = '',
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) { setShown(true); io.disconnect() }
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={ref} data-shown={shown} style={{ animationDelay: `${delay}ms` }} className={`reveal ${className}`}>
      {children}
    </div>
  )
}
