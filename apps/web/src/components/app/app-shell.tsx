'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Radio, TrendingUp, Users, Bookmark, User, Sparkles, Rss, MessageSquare, BarChart3, Download, Disc, Send } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FoundingBanner } from '@/components/social/founding-banner'

const PRIMARY = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/search', label: 'Cerca', icon: Search },
  { href: '/library', label: 'Library', icon: Radio },
  { href: '/mix', label: 'Per te', icon: Sparkles },
  { href: '/charts', label: 'Classifiche', icon: TrendingUp },
  { href: '/labels', label: 'Label', icon: Disc },
  { href: '/artists', label: 'Artisti', icon: Users },
]
const LIBRARY = [
  { href: '/feed', label: 'Feed', icon: Rss },
  { href: '/messages', label: 'Messaggi', icon: MessageSquare },
  { href: '/insights', label: 'Insights', icon: BarChart3 },
  { href: '/downloads', label: 'Download', icon: Download },
  { href: '/outcomes', label: 'I miei invii', icon: Send },
  { href: '/saved', label: 'Salvati', icon: Bookmark },
  { href: '/dashboard', label: 'Account', icon: User },
]

/** Guscio app con sidebar persistente (desktop), stile streaming. */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/'
  const isActive = (href: string) => href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')

  return (
    <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 sm:px-8">
      <aside className="sticky top-20 hidden h-[calc(100vh-7rem)] w-56 shrink-0 flex-col gap-6 lg:flex">
        <nav className="rounded-2xl border border-line bg-surface/40 p-3">
          {PRIMARY.map((i) => (
            <Item key={i.href} {...i} active={isActive(i.href)} />
          ))}
        </nav>
        <nav className="rounded-2xl border border-line bg-surface/40 p-3">
          <p className="px-3 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-wider text-faint">La tua libreria</p>
          {LIBRARY.map((i) => (
            <Item key={i.href} {...i} active={isActive(i.href)} />
          ))}
        </nav>
        <Link href="/match" className="mt-auto flex items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 text-sm font-semibold text-accent-ink transition-transform hover:scale-[1.02]">
          <Sparkles className="h-4 w-4" /> Analizza
        </Link>
      </aside>

      <main className="min-w-0 flex-1"><FoundingBanner />{children}</main>
    </div>
  )
}

function Item({ href, label, icon: Icon, active }: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; active: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
        active ? 'bg-surface-2 text-text' : 'text-muted hover:text-text',
      )}
    >
      <Icon className={cn('h-[18px] w-[18px]', active && 'text-accent')} /> {label}
    </Link>
  )
}
