'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Crown } from 'lucide-react'

interface Status {
  enabled: boolean
  open?: boolean
  spotsLeft?: number | null
  daysLeft?: number | null
  me?: { founding: boolean }
}

/** Banner Founding: badge se sei già membro, scarsità (posti/giorni) se è aperto.
 *  Si nasconde se il programma è spento o non configurato. */
export function FoundingBanner() {
  const [s, setS] = useState<Status | null>(null)

  useEffect(() => {
    let on = true
    fetch('/api/founding/status', { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (on) setS(d) }).catch(() => {})
    return () => { on = false }
  }, [])

  if (!s || !s.enabled) return null

  if (s.me?.founding) {
    return (
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
        <Crown className="h-4 w-4 shrink-0" /> Sei un <strong>Founding Member</strong> — vantaggi a vita 🎉
      </div>
    )
  }

  if (!s.open) return null
  const bits = [
    s.spotsLeft != null ? `${s.spotsLeft} posti rimasti` : null,
    s.daysLeft != null ? `scade tra ${s.daysLeft} ${s.daysLeft === 1 ? 'giorno' : 'giorni'}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2 text-sm">
      <span className="inline-flex items-center gap-2 text-text">
        <Crown className="h-4 w-4 shrink-0 text-accent" />
        <span><strong>Founding Members</strong> — i primi iscritti hanno vantaggi a vita{bits ? ` · ${bits}` : ''}.</span>
      </span>
      <Link href="/auth/login" className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-ink">Entra ora</Link>
    </div>
  )
}
