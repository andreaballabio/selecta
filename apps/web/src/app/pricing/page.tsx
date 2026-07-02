'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, Loader2, Sparkles, AlertTriangle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const TIERS = [
  { key: 'free', name: 'Free', price: '€0', cadence: 'per sempre', highlight: false, paid: false, perks: ['Analisi + match con le label', 'Pubblica nel catalogo', 'Press Kit, like, salvataggi', 'Streaming illimitato'] },
  { key: 'producer-pro', name: 'Producer Pro', price: '€9', cadence: 'al mese', highlight: false, paid: true, perks: ['Tutto del Free', 'Report tecnico PRO completo', 'Statistiche avanzate', 'Featured nel catalogo'] },
  { key: 'dj-pool', name: 'DJ Pool', price: '€15', cadence: 'al mese', highlight: true, paid: true, perks: ['Download illimitato (WAV/MP3)', 'Scarica per versione', 'Crate con download in blocco', 'Cronologia download'] },
  { key: 'label', name: 'Label', price: 'Su misura', cadence: 'B2B', highlight: false, paid: true, perks: ['Scouting sul tuo sound', 'Download per A&R', 'Classifiche emergenti', 'Contatto diretto producer'] },
]

export default function PricingPage() {
  const router = useRouter()
  const [authed, setAuthed] = useState(false)
  const [sub, setSub] = useState<{ tier: string; status: string } | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const load = async () => {
    const sb = createClient()
    const { data: { user } } = await sb.auth.getUser()
    if (!user) { setAuthed(false); return }
    setAuthed(true)
    const { data } = await (sb as any).from('subscriptions').select('tier, status').eq('user_id', user.id).maybeSingle()
    setSub(data ?? null)
  }
  useEffect(() => { load() }, [])

  const subscribe = async (tier: string) => {
    if (!authed) { router.push('/auth/login'); return }
    setBusy(tier)
    try {
      await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'subscribe', tier }) })
      await load()
    } finally { setBusy(null) }
  }
  const cancel = async () => {
    setBusy('cancel')
    try { await fetch('/api/billing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'cancel' }) }); await load() }
    finally { setBusy(null) }
  }

  const activeTier = sub?.status === 'active' ? sub.tier : null

  return (
    <div className="relative mx-auto max-w-6xl px-4 py-14 sm:px-8">
      <div className="glass mx-auto mb-8 flex max-w-2xl items-center justify-center gap-2 rounded-full px-4 py-2 text-sm text-amber-500">
        <AlertTriangle className="h-4 w-4 shrink-0" /> Pagamenti <strong>simulati</strong> (demo): l'attivazione è finta, nessun addebito. Stripe arriverà dopo.
      </div>

      <div className="a-in mb-12 text-center">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.22em] text-muted">Prezzi</p>
        <h1 className="font-display display-tight text-4xl font-semibold tracking-tight text-text sm:text-5xl">Scegli il tuo piano</h1>
        {activeTier && <p className="mt-3 text-muted">Piano attivo: <span className="font-semibold text-text">{TIERS.find((t) => t.key === activeTier)?.name}</span> · <button onClick={cancel} className="text-muted underline hover:text-text">disdici</button></p>}
      </div>

      <div className="grid gap-5 lg:grid-cols-4">
        {TIERS.map((t) => {
          const isActive = activeTier === t.key
          return (
            <div key={t.key} className={`flex flex-col rounded-3xl p-6 transition-all ${t.highlight ? 'glass-liquid glass-hover ring-1 ring-text/10' : 'glass glass-hover'}`}>
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl font-bold text-text">{t.name}</h3>
                {t.highlight && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">Popolare</span>}
              </div>
              <div className="mt-4 flex items-end gap-1.5">
                <span className="font-display text-4xl font-bold text-text">{t.price}</span>
                <span className="mb-1 text-sm text-muted">{t.cadence}</span>
              </div>
              <ul className="mt-6 flex-1 space-y-3">
                {t.perks.map((p) => <li key={p} className="flex items-start gap-2.5 text-sm text-muted"><Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {p}</li>)}
              </ul>
              {!t.paid ? (
                <Link href="/match" className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-line px-5 py-3 text-sm font-semibold text-text hover:border-faint"><Sparkles className="h-4 w-4" /> Inizia gratis</Link>
              ) : isActive ? (
                <button onClick={cancel} disabled={busy === 'cancel'} className="mt-6 inline-flex items-center justify-center gap-2 rounded-full border border-accent/40 px-5 py-3 text-sm font-semibold text-accent">{busy === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Attivo · disdici</button>
              ) : (
                <button onClick={() => subscribe(t.key)} disabled={busy === t.key} className={`mt-6 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-transform ${t.highlight ? 'bg-accent text-accent-ink hover:scale-[1.02]' : 'border border-line text-text hover:border-faint'}`}>
                  {busy === t.key ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Attiva (demo)
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
