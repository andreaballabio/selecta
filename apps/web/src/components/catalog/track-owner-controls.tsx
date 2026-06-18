'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Star, EyeOff, Eye, X, Loader2 } from 'lucide-react'

interface Initial {
  display_title: string | null; display_artist: string | null; cover_url: string | null
  genre: string | null; track_label: string | null; release_year: number | null; buy_url: string | null
  published: boolean
}

export function TrackOwnerControls({ submissionId, initial, initialPinned }: { submissionId: string; initial: Initial; initialPinned: boolean }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(initialPinned)
  const [published, setPublished] = useState(initial.published)
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({
    display_title: initial.display_title ?? '', display_artist: initial.display_artist ?? '', genre: initial.genre ?? '',
    track_label: initial.track_label ?? '', release_year: initial.release_year?.toString() ?? '', cover_url: initial.cover_url ?? '', buy_url: initial.buy_url ?? '',
  })

  const patch = (body: Record<string, unknown>) =>
    fetch('/api/catalog/track', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId, ...body }) })

  const save = async () => {
    setBusy(true)
    try {
      await patch({ ...form, release_year: form.release_year ? Number(form.release_year) : null })
      setOpen(false); router.refresh()
    } finally { setBusy(false) }
  }
  const togglePin = async () => {
    const np = !pinned; setPinned(np)
    await fetch('/api/spotlight', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId, pin: np }) })
    router.refresh()
  }
  const togglePublished = async () => {
    const np = !published; setPublished(np)
    await patch({ published: np }); router.refresh()
  }

  const inp = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder-faint focus:border-accent focus:outline-none'

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/40 p-2">
      <span className="px-2 text-xs font-semibold uppercase tracking-wider text-faint">Gestione</span>
      <button onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-text hover:border-faint"><Pencil className="h-4 w-4" /> Modifica</button>
      <button onClick={togglePin} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${pinned ? 'border-accent/40 text-accent' : 'border-line text-text hover:border-faint'}`}><Star className={`h-4 w-4 ${pinned ? 'fill-accent' : ''}`} /> {pinned ? 'In evidenza' : 'Metti in evidenza'}</button>
      <button onClick={togglePublished} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-muted hover:text-text">{published ? <><EyeOff className="h-4 w-4" /> Ritira</> : <><Eye className="h-4 w-4" /> Pubblica</>}</button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-bold text-text">Modifica traccia</h3>
              <button onClick={() => setOpen(false)} className="text-muted hover:text-text"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <input className={inp} value={form.display_title} onChange={(e) => setForm({ ...form, display_title: e.target.value })} placeholder="Titolo" />
              <input className={inp} value={form.display_artist} onChange={(e) => setForm({ ...form, display_artist: e.target.value })} placeholder="Artista" />
              <div className="grid grid-cols-2 gap-3">
                <input className={inp} value={form.genre} onChange={(e) => setForm({ ...form, genre: e.target.value })} placeholder="Genere" />
                <input className={inp} value={form.release_year} onChange={(e) => setForm({ ...form, release_year: e.target.value })} placeholder="Anno" inputMode="numeric" />
              </div>
              <input className={inp} value={form.track_label} onChange={(e) => setForm({ ...form, track_label: e.target.value })} placeholder="Label (opzionale)" />
              <input className={inp} value={form.cover_url} onChange={(e) => setForm({ ...form, cover_url: e.target.value })} placeholder="URL copertina" />
              <input className={inp} value={form.buy_url} onChange={(e) => setForm({ ...form, buy_url: e.target.value })} placeholder="Link 'ascolta/compra' (opzionale)" />
            </div>
            <button onClick={save} disabled={busy} className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink disabled:opacity-50">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Salva
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
