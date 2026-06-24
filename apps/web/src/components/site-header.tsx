'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { User } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { NotifBell } from '@/components/notifications/notif-bell'
import { AdminLink } from '@/components/admin/admin-link'
import { ThemeToggle } from '@/components/ui/theme-toggle'

const NAV = [
  { href: '/match', label: 'Analizza' },
  { href: '/library', label: 'Library' },
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

  if (pathname.startsWith('/admin') || pathname.startsWith('/u/') || pathname.startsWith('/preview')) return null

  return (
    <header className={cn(
      'sticky top-0 z-40 border-b transition-colors duration-300',
      scrolled ? 'border-line bg-bg/80 backdrop-blur-xl' : 'border-transparent',
    )}>
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
            <span className="flex items-end gap-[2px]">
              {[0, 1, 2].map((i) => (
                <span key={i} className="eq-bar w-[3px] rounded-full bg-accent-ink" style={{ height: 12, animationDelay: `${i * 0.15}s` }} />
              ))}
            </span>
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-text">Selecta</span>
        </Link>

        <nav className="flex items-center gap-1">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'relative hidden rounded-lg px-3.5 py-2 text-sm font-medium transition-colors sm:block',
                  active ? 'text-text' : 'text-muted hover:text-text',
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-3.5 -bottom-px h-px bg-accent" />}
              </Link>
            )
          })}

          <ThemeToggle className="ml-1" />

          {authed ? (
            <>
              <AdminLink variant="icon" />
              <NotifBell />
              <Link
                href="/dashboard"
                className="ml-1 flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 text-sm font-semibold text-text ring-1 ring-line transition-colors hover:ring-faint"
              >
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Account</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hidden rounded-lg px-3.5 py-2 text-sm font-medium text-muted hover:text-text sm:block">
                Accedi
              </Link>
              <Link
                href="/match"
                className="ml-1 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink transition-transform hover:scale-[1.03]"
              >
                Inizia gratis
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
