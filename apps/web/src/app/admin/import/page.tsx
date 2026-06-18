'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Loader2, ArrowLeft, Check, Disc, Play } from 'lucide-react'

interface LabelCand { name: string; releases: number; cover: string | null; latest: string }
interface DzTrack { deezer_id: string; title: string; artist: string; album: string; release_date: string; preview_url: string | null; cover: string | null; duration_ms: number; already: boolean }

export default function ImportPage() {
  const router = useRouter()
  const [step, setStep] = useState<'search' | 'tracks'>('search')
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [labels, setLabels] = useState<LabelCand[] | null>(null)
  const [label, setLabel] = useState<LabelCand | null>(null)
  const [genre, setGenre] = useState('Tech House')
  const [tracks, setTracks] = useState<DzTrack[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const search = async () => {
    if (q.trim().length < 2) return
    setLoading(true); setLabels(null)
    try { const d = await fetch(`/api/admin/deezer-label-search?q=${encodeURIComponent(q.trim())}`).then((r) => r.json()); setLabels(d.labels ?? []) }
    finally { setLoading(false) }
  }

  const openLabel = async (l: LabelCand) => {
    setLabel(l); setStep('tracks'); setLoading(true); setTracks([]); setSel(new Set()); setProgress(null)
    try {
      // Risposta in streaming NDJSON → contatore "x/y album" mentre Deezer carica
      const res = await fetch(`/api/admin/deezer-label-tracks?label=${encodeURIComponent(l.name)}`)
      const reader = res.body?.getReader()
      if (!reader) return
      const dec = new TextDecoder()
      let buf = ''
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        buf += dec.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          let msg: { type: string; done?: number; total?: number; tracks?: DzTrack[] }
          try { msg = JSON.parse(line) } catch { continue }
          if (msg.type === 'progress') {
            setProgress({ done: msg.done ?? 0, total: msg.total ?? 0 })
          } else if (msg.type === 'result') {
            const ts: DzTrack[] = msg.tracks ?? []
            setTracks(ts)
            setSel(new Set(ts.filter((t) => !t.already && t.preview_url).map((t) => t.deezer_id))) // preseleziona le nuove
          }
        }
      }
    } finally { setLoading(false); setProgress(null) }
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })

  const doImport = async () => {
    const chosen = tracks.filter((t) => sel.has(t.deezer_id))
    if (chosen.length === 0 || !label) return
    setImporting(true)
    try {
      const d = await fetch('/api/admin/deezer-import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_name: label.name, primary_genre: genre, tracks: chosen }) }).then((r) => r.json())
      if (d.label_id) router.push(`/admin/label/${d.label_id}?analyze=1`) // avvia subito l'analisi
    } finally { setImporting(false) }
  }

  const newCount = tracks.filter((t) => !t.already).length

  if (step === 'tracks' && label) {
    return (
      <div>
        <button onClick={() => setStep('search')} className="mb-4 flex items-center gap-1.5 text-sm text-muted hover:text-text"><ArrowLeft className="h-4 w-4" /> Cerca un'altra label</button>
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-text">{label.name}</h1>
            <p className="mt-1 text-sm text-muted">{tracks.length} tracce su Deezer · {newCount} nuove · ultima uscita {label.latest || '—'}</p>
          </div>
          <div className="flex items-center gap-2">
            <input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Genere" className="w-32 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none" />
            <button onClick={doImport} disabled={importing || sel.size === 0} className="flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-accent-ink disabled:opacity-50">
              {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Importa {sel.size} → analizza
            </button>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-muted" />
            {progress ? (
              <>
                <p className="text-sm text-muted">Carico le uscite da Deezer… <span className="font-medium text-text">{progress.done}/{progress.total}</span> album</p>
                <div className="mx-auto mt-3 h-1.5 w-56 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-accent transition-all duration-300" style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }} />
                </div>
                <p className="mt-2 text-xs text-faint">Ritmo controllato per non superare i limiti di Deezer</p>
              </>
            ) : (
              <p className="text-sm text-muted">Cerco gli album della label…</p>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-line">
            {tracks.map((t) => (
              <label key={t.deezer_id} className={`flex cursor-pointer items-center gap-3 border-b border-line px-4 py-2.5 last:border-0 ${t.already ? 'opacity-50' : 'hover:bg-surface/60'}`}>
                <input type="checkbox" checked={sel.has(t.deezer_id)} disabled={t.already || !t.preview_url} onChange={() => toggle(t.deezer_id)} className="h-4 w-4 accent-[var(--accent)]" />
                <div className="h-9 w-9 shrink-0 overflow-hidden rounded bg-surface-2">{t.cover
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={t.cover} alt="" className="h-full w-full object-cover" /> : <Disc className="m-2 h-5 w-5 text-faint" />}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{t.title}</p>
                  <p className="truncate text-xs text-muted">{t.artist} · {t.album}</p>
                </div>
                {t.preview_url && <a href={t.preview_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-faint hover:text-accent" title="Ascolta preview"><Play className="h-4 w-4" /></a>}
                <span className="w-20 shrink-0 text-right text-xs text-faint">{t.release_date || ''}</span>
                {t.already ? <span className="w-16 shrink-0 text-right text-xs text-accent">presente</span> : !t.preview_url ? <span className="w-16 shrink-0 text-right text-xs text-red-400">no audio</span> : <span className="w-16 shrink-0 text-right text-xs text-muted">nuova</span>}
              </label>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-3xl font-bold text-text">Importa da Deezer</h1>
      <p className="mb-6 text-sm text-muted">Cerca una label, scegline una, vedi le tracce in ordine di uscita e avvia l'analisi.</p>

      <div className="mb-8 flex max-w-lg gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && search()} placeholder="Nome label (es. Solid Grooves)" className="w-full rounded-lg border border-line bg-surface-2 py-2.5 pl-10 pr-3 text-text placeholder-faint focus:border-accent focus:outline-none" />
        </div>
        <button onClick={search} disabled={loading} className="rounded-lg bg-accent px-5 text-sm font-semibold text-accent-ink disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Cerca'}</button>
      </div>

      {labels && (labels.length === 0 ? (
        <p className="text-muted">Nessuna label trovata. Prova un altro nome.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {labels.map((l) => (
            <button key={l.name} onClick={() => openLabel(l)} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 p-4 text-left hover:border-faint">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">{l.cover
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={l.cover} alt="" className="h-full w-full object-cover" /> : <Disc className="m-3 h-6 w-6 text-faint" />}</div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-text">{l.name}</p>
                <p className="text-xs text-muted">{l.releases}+ uscite · ultima {l.latest || '—'}</p>
              </div>
            </button>
          ))}
        </div>
      ))}
    </div>
  )
}
