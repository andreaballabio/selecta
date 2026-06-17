'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Sparkles, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

/**
 * Header di navigazione globale.
 * Mostra lo stato di login: "Dashboard" se loggato, "Accedi" se no.
 * Nascosto su /admin e sulle press kit pubbliche /u/.
 */
const NAV = [
  { href: '/match', label: 'Analizza' },
  { href: '/#how-it-works', label: 'Come funziona' },
]

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  // Niente header globale nell'area admin né sulle press kit pubbliche /u/
  if (pathname.startsWith('/admin') || pathname.startsWith('/u/')) return null

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
                  'hidden rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:block',
                  active ? 'bg-zinc-900 text-white' : 'text-zinc-400 hover:text-white'
                )}
              >
                {item.label}
              </Link>
            )
          })}

          {authed ? (
            <Link
              href="/dashboard"
              className="ml-2 flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
            >
              <LayoutDashboard className="h-4 w-4" /> Dashboard
            </Link>
          ) : (
            <>
              <Link href="/auth/login" className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-300 hover:text-white">
                Accedi
              </Link>
              <Link
                href="/match"
                className="ml-1 rounded-lg bg-emerald-500 px-3.5 py-1.5 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
              >
                Inizia
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
