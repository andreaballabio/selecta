'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LayoutDashboard, Users, Disc, ArrowLeft, Flag, DownloadCloud, BarChart3, Target, Music, Crown, ImageIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import QueueIndicator from '@/components/admin/queue-indicator'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/insights', label: 'Insights', icon: BarChart3 },
  { href: '/admin/eval', label: 'Validazione', icon: Target },
  { href: '/admin/users', label: 'Utenti', icon: Users },
  { href: '/admin/founding', label: 'Founding', icon: Crown },
  { href: '/admin/labels', label: 'Label', icon: Disc },
  { href: '/admin/label-icons', label: 'Icone', icon: ImageIcon },
  { href: '/admin/catalog', label: 'Catalogo', icon: Music },
  { href: '/admin/import', label: 'Importa', icon: DownloadCloud },
  { href: '/admin/reports', label: 'Segnalazioni', icon: Flag },
]

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/admin'
  const active = (i: typeof NAV[number]) => i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(i.href + '/')

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4 sm:px-8">
          <div className="flex items-center gap-2">
            <span className="rounded bg-accent px-2 py-0.5 text-xs font-bold text-accent-ink">ADMIN</span>
            <span className="font-display text-sm font-bold text-text">Selecta</span>
          </div>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {NAV.map((i) => (
              <Link key={i.href} href={i.href} className={cn('flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors', active(i) ? 'bg-surface-2 text-text' : 'text-muted hover:text-text')}>
                <i.icon className="h-4 w-4" /> {i.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <QueueIndicator />
            <Link href="/" className="flex items-center gap-1 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Sito</span></Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-8">{children}</main>
    </div>
  )
}
