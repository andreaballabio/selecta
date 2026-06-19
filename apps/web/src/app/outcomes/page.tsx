'use client'

import { useEffect, useState } from 'react'
import { Send, Loader2, Plus } from 'lucide-react'
import { AppShell } from '@/components/app/app-shell'
import { computeOutcomeStats, STATUS_LABEL, OUTCOME_STATUSES, type OutcomeStatus } from '@/lib/outcomes'

interface Outcome {
  id: string; submission_id: string | null; label_id: string | null; label_name: string | null
  status: OutcomeStatus; note: string | null; sent_at: string | null; created_at: string
}

const STATUS_TONE: Record<OutcomeStatus, string> = {
  sent: 'bg-surface-2 text-muted',
  no_reply: 'bg-surface-2 text-faint',
  rejected: 'bg-red-500/15 text-red-400',
  interested: 'bg-yellow-500/15 text-yellow-400',
  signed: 'bg-accent/15 text-accent',
}

export default function OutcomesPage() {
  const [items, setItems] = useState<Outcome[] | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)
  const [needsMigration, setNeedsMigration] = useState(false)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const load = async () => {
    const r = await fetch('/api/outcomes', { cache: 'no-store' })
    if (r.status === 401) { setNeedsAuth(true); setItems([]); return }
    const d = await r.json()
    setNeedsMigration(!!d.needsMigration)
    setItems(d.outcomes ?? [])
  }
  // setState fuori dal corpo sincrono dell'effect (macrotask) → niente cascading render.
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const add = async () => {
    const name = label.trim()
    if (!name) return
    setBusy(true)
    try {
      const r = await fetch('/api/outcomes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_name: name }) })
      if (r.ok) { setLabel(''); await load() }
    } finally { setBusy(false) }
  }

  const setStatus = async (id: string, status: OutcomeStatus) => {
    setItems((prev) => prev?.map((o) => o.id === id ? { ...o, status } : o) ?? prev) // ottimistico
    await fetch('/api/outcomes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
  }

  const stats = computeOutcomeStats(items ?? [])
  const pct = (x: number) => Math.round(x * 100) + '%'

  return (
    <AppShell>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-3xl font-bold text-text">I miei invii</h1>
          <p className="mt-1 max-w-2xl text-muted">Tieni traccia di dove hai mandato le tue tracce e com’è andata. Ogni risposta ci aiuta a capire <strong className="text-text">quali label firmano davvero il tuo suono</strong>.</p>
        </header>

        {needsAuth && <div className="rounded-xl border border-line bg-surface/40 px-4 py-3 text-sm text-muted">Accedi per registrare e seguire i tuoi invii.</div>}
        {needsMigration && <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-400">Funzione da attivare: esegui la migration <strong>0015</strong> su Supabase.</div>}

        {!needsAuth && (
          <>
            {/* Statistiche = il segnale di esito */}
            <div className="grid gap-4 sm:grid-cols-4">
              <Stat label="Inviate" value={String(stats.total)} />
              <Stat label="Risposte" value={pct(stats.responseRate)} hint={`${stats.responded} su ${stats.total}`} />
              <Stat label="Interessati" value={String(stats.interested)} />
              <Stat label="Firmate" value={String(stats.signed)} accent />
            </div>

            {/* Aggiungi invio */}
            <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface/40 p-3">
              <input value={label} onChange={(e) => setLabel(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()}
                placeholder="Nome della label a cui hai inviato…"
                className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder-faint focus:border-accent focus:outline-none" />
              <button onClick={add} disabled={busy || !label.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Registra invio
              </button>
            </div>

            {/* Lista */}
            {items === null ? (
              <p className="py-10 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
            ) : items.length === 0 ? (
              <p className="flex flex-col items-center gap-2 py-12 text-center text-muted"><Send className="h-6 w-6 text-faint" /> Nessun invio ancora. Registra il primo qui sopra.</p>
            ) : (
              <div className="space-y-2">
                {items.map((o) => (
                  <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/40 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-text">{o.label_name || o.label_id || '—'}</p>
                      <p className="text-xs text-faint">{(o.sent_at || o.created_at || '').slice(0, 10)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${STATUS_TONE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      <select value={o.status} onChange={(e) => setStatus(o.id, e.target.value as OutcomeStatus)}
                        className="rounded-lg border border-line bg-surface-2 px-2 py-1 text-xs text-text focus:border-accent focus:outline-none">
                        {OUTCOME_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  )
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${accent ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface/40'}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-3xl font-bold ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-faint">{hint}</p>}
    </div>
  )
}
