'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Header di navigazione globale del sito.
 * Prima non esisteva: le pagine si raggiungevano solo via link diretto.
 * Nascosto sull'area /admin (ha una sua UI separata).
 */
const NAV = [
  { href: '/match', label: 'Analizza' },
  { href: '/reference', label: 'Reference' },
]

export function SiteHeader() {
  const pathname = usePathname() ?? '/'

  // Niente header globale nell'area admin
  if (pathname.startsWith('/admin')) return null

  return (
    <header className="sticky top-0 z-40 border-b border-zinc-900/80 bg-black/70 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
            <Sparkles className="h-4 w-4 text-black" />
          </span>
          <span className="text-[15px] font-bold tracking-tight text-white">Selecta</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'bg-zinc-900 text-white'
                    : 'text-zinc-400 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            )
          })}
          <Link
            href="/match"
            className="ml-2 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
          >
            Inizia
          </Link>
        </nav>
      </div>
    </header>
  )
}
