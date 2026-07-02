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

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session))
    return () => { subscription.unsubscribe() }
  }, [])

  if (pathname === '/' || pathname.startsWith('/admin') || pathname.startsWith('/u/') || pathname.startsWith('/preview')) return null

  return (
    <header className="sticky top-3 z-40 px-3 sm:top-4 sm:px-4">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full pl-4 pr-2">
        {/* logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex items-end gap-[2px]">
            {[0, 1, 2].map((i) => (
              <span key={i} className="eq-bar w-[3px] rounded-full bg-text" style={{ height: 14, animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
          <span className="font-display text-[17px] font-semibold tracking-tight text-text">Selecta</span>
        </Link>

        {/* nav */}
        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-text/[0.07] text-text' : 'text-muted hover:text-text',
                )}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* azioni */}
        <div className="flex shrink-0 items-center gap-1.5">
          <ThemeToggle />
          {authed ? (
            <>
              <AdminLink variant="icon" />
              <NotifBell />
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg transition-transform hover:scale-[1.03]"
              >
                <User className="h-4 w-4" /> <span className="hidden sm:inline">Account</span>
              </Link>
            </>
          ) : (
            <>
              <Link href="/auth/login" className="hidden rounded-full px-3 py-2 text-sm font-medium text-muted hover:text-text sm:block">
                Accedi
              </Link>
              <Link
                href="/match"
                className="inline-flex items-center rounded-full bg-text px-4 py-2 text-sm font-semibold text-bg transition-transform hover:scale-[1.03]"
              >
                Inizia gratis
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
