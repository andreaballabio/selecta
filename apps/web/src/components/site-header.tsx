'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

const NAV = [
  { href: '/match', label: 'Analizza' },
  { href: '/catalog', label: 'Catalogo' },
  { href: '/charts', label: 'Classifiche' },
  { href: '/artists', label: 'Artisti' },
]

export function SiteHeader() {
  const pathname = usePathname() ?? '/'
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => { subscription.unsubscribe(); window.removeEventListener('scroll', onScroll) }
  }, [])

  if (pathname.startsWith('/admin') || pathname.startsWith('/u/')) return null

  return (
    <header className={cn(
      'sticky top-0 z-40 border-b transition-colors duration-300',
      scrolled ? 'border-zinc-800/80 bg-black/70 backdrop-blur-xl' : 'border-transparent bg-transparent',
    )}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="group flex items-center gap-2.5">
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-emerald-500">
            <span className="flex items-end gap-0.5">
              {[0, 1, 2].map((i) => (
                <span key={i} className="eq-bar w-[3px] rounded-full bg-black" style={{ height: 12, animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </span>
          <span className="font-display text-[17px] font-bold tracking-tight text-white">Selecta</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative hidden rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:block',
                  active ? 'text-white' : 'text-zinc-400 hover:text-white',
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-px bg-emerald-400" />}
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
