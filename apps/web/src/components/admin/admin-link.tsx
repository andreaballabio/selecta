'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Shield } from 'lucide-react'

/** Mostra un accesso all'area admin SOLO se l'utente loggato è admin. */
export function AdminLink({ variant = 'card' }: { variant?: 'card' | 'icon' | 'button' }) {
  const [admin, setAdmin] = useState(false)
  useEffect(() => { fetch('/api/is-admin').then((r) => r.json()).then((d) => setAdmin(!!d.admin)).catch(() => {}) }, [])
  if (!admin) return null

  if (variant === 'icon') {
    return (
      <Link href="/admin" title="Pannello Admin" className="flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-accent" aria-label="Admin">
        <Shield className="h-[18px] w-[18px]" />
      </Link>
    )
  }
  if (variant === 'button') {
    return (
      <Link href="/admin" className="flex items-center gap-1.5 rounded-full border border-accent/40 px-4 py-2 text-sm font-medium text-accent hover:border-accent/60">
        <Shield className="h-4 w-4" /> Admin
      </Link>
    )
  }
  return (
    <Link href="/admin" className="group flex items-center gap-3 rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 transition-colors hover:border-accent/50">
      <Shield className="h-6 w-6 text-accent" />
      <div><p className="font-semibold text-text">Pannello Admin</p><p className="mt-0.5 text-sm text-muted">Utenti, label, segnalazioni</p></div>
    </Link>
  )
}
