'use client'

import { useEffect, useState } from 'react'
import { Loader2, Crown, Plus, Trash2, Check, AlertTriangle } from 'lucide-react'
import type { FoundingConfig, FoundingPerk } from '@/lib/founding'

interface State { config: FoundingConfig; count: number; open: boolean; spotsLeft: number | null; daysLeft: number | null; needsMigration?: boolean }

export default function FoundingAdminPage() {
  const [s, setS] = useState<State | null>(null)
  const [cfg, setCfg] = useState<FoundingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/admin/founding', { cache: 'no-store' }).then((r) => r.json())
      setS(d); if (d.config) setCfg(d.config)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const d = await fetch('/api/admin/founding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).then((r) => r.json())
      if (d.config) { setS(d); setCfg(d.config); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } finally { setSaving(false) }
  }

  const setPerk = (i: number, patch: Partial<FoundingPerk>) =>
    setCfg((c) => c ? { ...c, perks: c.perks.map((p, j) => j === i ? { ...p, ...patch } : p) } : c)
  const addPerk = () => setCfg((c) => c ? { ...c, perks: [...c.perks, { label: '', enabled: true }] } : c)
  const removePerk = (i: number) => setCfg((c) => c ? { ...c, perks: c.perks.filter((_, j) => j !== i) } : c)

  if (loading) return <p className="py-12 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
  if (s?.needsMigration) return <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/15 px-4 py-3 text-sm text-yellow-300"><AlertTriangle className="mr-2 inline h-4 w-4" />Esegui la migration <strong>0018</strong> su Supabase, poi ricarica.</div>
  if (!cfg) return null

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-text"><Crown className="h-6 w-6 text-accent" /> Founding Members</h1>
        <p className="mt-1 text-muted">I primi iscritti ottengono vantaggi a vita. La finestra si chiude al <strong className="text-text">primo</strong> tra: scadenza data o tetto membri.</p>
      </header>

      {/* Stato */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Membri" value={String(s?.count ?? 0)} />
        <Stat label="Posti rimasti" value={s?.spotsLeft == null ? '∞' : String(s.spotsLeft)} />
        <Stat label="Giorni rimasti" value={s?.daysLeft == null ? '∞' : String(s.daysLeft)} />
        <Stat label="Stato" value={s?.open ? 'APERTO' : 'chiuso'} accent={s?.open} />
      </div>

      {/* Parametri */}
      <div className="space-y-4 rounded-2xl border border-line bg-surface/40 p-5">
        <label className="flex items-center justify-between gap-3">
          <span className="text-sm font-medium text-text">Programma attivo</span>
          <button onClick={() => setCfg({ ...cfg, enabled: !cfg.enabled })}
            className={`rounded-full px-3 py-1 text-sm font-semibold ${cfg.enabled ? 'bg-accent text-accent-ink' : 'border border-line text-muted'}`}>
            {cfg.enabled ? 'Attivo' : 'Spento'}
          </button>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-sm text-muted">Scadenza (data)</span>
            <input type="date" value={cfg.deadline ? cfg.deadline.slice(0, 10) : ''} onChange={(e) => setCfg({ ...cfg, deadline: e.target.value || null })}
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none" />
          </label>
          <label className="block">
            <span className="text-sm text-muted">Tetto membri</span>
            <input type="number" min={1} value={cfg.cap ?? ''} onChange={(e) => setCfg({ ...cfg, cap: e.target.value ? Number(e.target.value) : null })}
              placeholder="nessun limite"
              className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-text focus:border-accent focus:outline-none" />
          </label>
        </div>
        <p className="text-xs text-faint">Lascia vuoto un campo per «nessun limite» su quel parametro.</p>
      </div>

      {/* Benefici */}
      <div className="space-y-3 rounded-2xl border border-line bg-surface/40 p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-text">Benefici Founding</h2>
          <button onClick={addPerk} className="inline-flex items-center gap-1 text-sm text-accent"><Plus className="h-4 w-4" /> Aggiungi</button>
        </div>
        {cfg.perks.map((p, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="checkbox" checked={p.enabled} onChange={(e) => setPerk(i, { enabled: e.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />
            <input value={p.label} onChange={(e) => setPerk(i, { label: e.target.value })} placeholder="Descrizione beneficio…"
              className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-text focus:border-accent focus:outline-none" />
            <button onClick={() => removePerk(i)} className="text-faint hover:text-red-400"><Trash2 className="h-4 w-4" /></button>
          </div>
        ))}
        {cfg.perks.length === 0 && <p className="text-sm text-muted">Nessun beneficio. Aggiungine uno.</p>}
      </div>

      <button onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? 'Salvato' : 'Salva impostazioni'}
      </button>
    </div>
  )
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-3 ${accent ? 'border-accent/40 bg-accent/5' : 'border-line bg-surface/40'}`}>
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent ? 'text-accent' : 'text-text'}`}>{value}</p>
    </div>
  )
}
