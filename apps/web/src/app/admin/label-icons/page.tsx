'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Check, ImageIcon, Search, AlertTriangle, Upload, X } from 'lucide-react'

type Label = { id: string; name: string; slug: string; primary_genre: string | null; cataloged_tracks: number; icon_url: string | null }

export default function LabelIconsPage() {
  const [labels, setLabels] = useState<Label[] | null>(null)
  const [needsMig, setNeedsMig] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const targetId = useRef<string | null>(null)

  const load = async () => {
    const d = await fetch('/api/admin/label-icons', { cache: 'no-store' }).then((r) => r.json())
    setNeedsMig(!!d.needsMigration)
    setLabels(d.labels || [])
  }
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [])

  const pick = (id: string) => { targetId.current = id; inputRef.current?.click() }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const id = targetId.current
    e.target.value = ''
    if (!file || !id) return
    setErr(null); setBusy(id)
    try {
      const fd = new FormData(); fd.append('id', id); fd.append('file', file)
      const d = await fetch('/api/admin/label-icons', { method: 'POST', body: fd }).then((r) => r.json())
      if (d.ok) { setLabels((ls) => ls!.map((x) => x.id === id ? { ...x, icon_url: d.icon_url } : x)); setSavedId(id); setTimeout(() => setSavedId(null), 1500) }
      else setErr(d.error || 'Errore upload')
    } finally { setBusy(null) }
  }

  const remove = async (id: string) => {
    setBusy(id)
    try {
      const d = await fetch('/api/admin/label-icons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).then((r) => r.json())
      if (d.ok) setLabels((ls) => ls!.map((x) => x.id === id ? { ...x, icon_url: null } : x))
    } finally { setBusy(null) }
  }

  if (labels === null) return <p className="py-12 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
  const filtered = labels.filter((l) => l.name.toLowerCase().includes(q.toLowerCase()))
  const done = labels.filter((l) => l.icon_url).length

  return (
    <div className="max-w-3xl space-y-6">
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="hidden" onChange={onFile} />

      <header>
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold text-text"><ImageIcon className="h-6 w-6 text-accent" /> Icone delle label</h1>
        <p className="mt-1 text-muted">Carica un logo (PNG) per ogni label. <strong className="text-text">{done}/{labels.length}</strong> impostate. Le nuove label compaiono qui automaticamente.</p>
      </header>

      {needsMig && (
        <div className="rounded-xl border border-yellow-500/30 bg-yellow-950/15 px-4 py-3 text-sm text-yellow-300">
          <AlertTriangle className="mr-2 inline h-4 w-4" />Esegui la migration <strong>0019_label_icons</strong> su Supabase (colonna + bucket Storage), poi ricarica.
        </div>
      )}
      {err && <div className="rounded-xl border border-red-500/30 bg-red-950/15 px-4 py-3 text-sm text-red-300">{err}</div>}

      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
        <Search className="h-4 w-4 text-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca label…" className="flex-1 bg-transparent text-text outline-none placeholder:text-faint" />
      </div>

      <div className="divide-y divide-line rounded-2xl border border-line">
        {filtered.map((l) => (
          <div key={l.id} className="flex items-center gap-4 p-3">
            {l.icon_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={l.icon_url} alt="" className="h-12 w-12 shrink-0 rounded-xl bg-surface-2 object-contain p-1 ring-1 ring-line" />
              : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-base font-bold text-faint ring-1 ring-line">{l.name[0]}</span>}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-text">{l.name}</p>
              <p className="truncate text-xs text-muted">{l.primary_genre || '—'} · {l.cataloged_tracks} tracce</p>
            </div>
            {l.icon_url && (
              <button onClick={() => remove(l.id)} disabled={busy === l.id} className="text-faint transition-colors hover:text-red-400" title="Rimuovi"><X className="h-4 w-4" /></button>
            )}
            <button onClick={() => pick(l.id)} disabled={busy === l.id} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink transition-opacity disabled:opacity-50">
              {busy === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : savedId === l.id ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
              {savedId === l.id ? 'Fatto' : l.icon_url ? 'Cambia' : 'Carica PNG'}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <p className="p-6 text-center text-sm text-muted">Nessuna label trovata.</p>}
      </div>
    </div>
  )
}
