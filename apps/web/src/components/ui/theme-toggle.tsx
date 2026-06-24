'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/utils'

type Theme = 'dark' | 'light'

/** Switch chiaro/scuro in stile "liquid glass".
 *  Default = chiaro; lo scuro si attiva con data-theme="dark" su <html>. */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const sync = () => setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light')
    const t = setTimeout(sync, 0)
    return () => clearTimeout(t)
  }, [])

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    if (next === 'dark') document.documentElement.setAttribute('data-theme', 'dark')
    else document.documentElement.removeAttribute('data-theme')
    try { localStorage.setItem('selecta-theme', next) } catch { /* noop */ }
  }

  const dark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Passa al tema chiaro' : 'Passa al tema scuro'}
      title={dark ? 'Tema chiaro' : 'Tema scuro'}
      className={cn(
        'glass relative flex h-9 w-[68px] items-center rounded-full p-1 transition-colors',
        className,
      )}
    >
      {/* knob di vetro che scorre */}
      <span
        className={cn(
          'glass flex h-7 w-7 items-center justify-center rounded-full text-text transition-transform duration-400',
          dark ? 'translate-x-[32px]' : 'translate-x-0',
        )}
        style={{ transitionTimingFunction: 'cubic-bezier(0.175,0.885,0.32,1.6)' }}
      >
        {dark ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
      </span>
    </button>
  )
}
