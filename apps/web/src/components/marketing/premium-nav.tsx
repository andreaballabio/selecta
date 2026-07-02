'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { ThemeToggle } from '@/components/ui/theme-toggle'

/* Navbar premium: pillola di vetro con un evidenziatore che SCORRE sotto la
   voce su cui passi il mouse (interattiva). Integra i "pilastri" (ex dock). */

const LINKS = [
  { label: 'Analizza', href: '/match' },
  { label: 'Catalogo', href: '/library' },
  { label: 'Classifiche', href: '/charts' },
  { label: 'Prezzi', href: '/pricing' },
]

export function PremiumNav() {
  const [hl, setHl] = useState({ left: 0, width: 0, opacity: 0 })
  const enter = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = e.currentTarget
    setHl({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 })
  }

  return (
    <div className="a-in sticky top-4 z-40 px-4">
      <nav className="glass mx-auto flex h-14 max-w-[880px] items-center justify-between rounded-full pl-5 pr-2">
        {/* logo */}
        <Link href="/" className="group flex items-center gap-2">
          <span className="flex items-end gap-[2px]">
            {[0, 1, 2].map((i) => <span key={i} className="eq-bar w-[3px] rounded-full bg-text" style={{ height: 14, animationDelay: `${i * 0.15}s` }} />)}
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight">Selecta</span>
        </Link>

        {/* link con evidenziatore scorrevole */}
        <div className="relative hidden items-center md:flex" onMouseLeave={() => setHl((h) => ({ ...h, opacity: 0 }))}>
          <span
            aria-hidden
            className="glass pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-300 ease-out"
            style={{ left: hl.left, width: hl.width, height: 38, opacity: hl.opacity }}
          />
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onMouseEnter={enter} className="relative z-10 rounded-full px-4 py-2 text-[15px] font-medium text-muted transition-colors hover:text-text">
              {l.label}
            </Link>
          ))}
        </div>

        {/* azioni */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/auth/login" className="group inline-flex items-center gap-1.5 rounded-full bg-text px-5 py-2 text-sm font-semibold text-bg transition-transform hover:scale-[1.04]">
            Entra <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </nav>
    </div>
  )
}
