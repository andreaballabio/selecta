'use client'

import { useEffect, useState } from 'react'
import { Loader2, Check, BarChart3, AlertTriangle } from 'lucide-react'
import { STAT_KEYS, STAT_LABELS, displayStat, type HomeStatsConfig, type StatKey } from '@/lib/home-stats'

type Real = Record<StatKey, number>

export default function HomeStatsAdminPage() {
  const [cfg, setCfg] = useState<HomeStatsConfig | null>(null)
  const [real, setReal] = useState<Real | null>(null)
  const [needsMig, setNeedsMig] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const d = await fetch('/api/admin/home-stats', { cache: 'no-store' }).then((r) => r.json())
      if (d.needsMigration) { setNeedsMig(true); return }
      setCfg(d.config); setReal(d.real)
    } finally { setLoading(false) }
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const setRule = (k: StatKey, patch: Partial<{ manual: number; threshold: number }>) =>
    setCfg((c) => c ? { ...c, [k]: { ...c[k], ...patch } } : c)

  const save = async () => {
    if (!cfg) return
    setSaving(true)
    try {
      const d = await fetch('/api/admin/home-stats', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cfg) }).then((r) => r.json())
      if (d.config) { setCfg(d.config); setReal(d.real); setSaved(true); setTimeout(() => setSaved(false), 2000) }
    } finally { setSaving(false) }
  }

  if (loading) return <p className="py-12 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
  if (needsMig) return <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/15 px-4 py-3 text-sm text-yellow-300"><AlertTriangle className="mr-2 inline h-4 w-4" />Esegui la migration <strong>0018</strong> (tabella app_settings) su Supabase, poi ricarica.</div>
  if (!cfg || !real) return null

  return (
    <div className="max-w-2xl space-y-6">
      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-text"><BarChart3 className="h-6 w-6 text-accent" /> Numeri della home</h1>
        <p className="mt-1 text-muted">Finché il numero reale è <strong className="text-text">sotto la soglia</strong> la home mostra il valore manuale; raggiunta la soglia, passa <strong className="text-text">automaticamente al reale</strong>.</p>
      </header>

      <div className="space-y-3">
        {STAT_KEYS.map((k) => {
          const shown = displayStat(real[k], cfg[k])
          const isReal = real[k] >= cfg[k].threshold
          return (
            <div key={k} className="rounded-2xl border border-line bg-surface/40 p-5">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg font-semibold text-text">{STAT_LABELS[k]}</h2>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${isReal ? 'bg-accent text-accent-ink' : 'border border-line text-muted'}`}>
                  mostra: {shown.toLocaleString('it-IT')} · {isReal ? 'REALE' : 'manuale'}
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <span className="text-xs text-muted">Reale (ora)</span>
                  <p className="mt-1 font-mono text-lg text-text">{real[k].toLocaleString('it-IT')}</p>
                </div>
                <label className="block">
                  <span className="text-xs text-muted">Valore manuale</span>
                  <input type="number" min={0} value={cfg[k].manual}
                    onChange={(e) => setRule(k, { manual: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-text outline-none focus:border-faint" />
                </label>
                <label className="block">
                  <span className="text-xs text-muted">Soglia (passa al reale)</span>
                  <input type="number" min={0} value={cfg[k].threshold}
                    onChange={(e) => setRule(k, { threshold: Number(e.target.value) })}
                    className="mt-1 w-full rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-text outline-none focus:border-faint" />
                </label>
              </div>
            </div>
          )
        })}
      </div>

      <button onClick={save} disabled={saving}
        className="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 font-semibold text-accent-ink transition-opacity disabled:opacity-50">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}
        {saved ? 'Salvato' : 'Salva'}
      </button>
    </div>
  )
}
