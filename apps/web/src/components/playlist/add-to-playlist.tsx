'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ListPlus, Plus, Check, Loader2 } from 'lucide-react'

interface PL { id: string; title: string }

export function AddToPlaylist({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false)
  const [playlists, setPlaylists] = useState<PL[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const [newTitle, setNewTitle] = useState('')

  const toggleOpen = async () => {
    const next = !open
    setOpen(next)
    if (next && playlists === null) {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/auth/login'; return }
      const { data } = await (supabase as any).from('playlists').select('id, title').eq('user_id', user.id).order('updated_at', { ascending: false })
      setPlaylists((data as PL[]) ?? [])
    }
  }

  const add = async (pid: string) => {
    setBusy(pid)
    try {
      await fetch(`/api/playlists/${pid}/tracks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId }) })
      setAdded((s) => new Set(s).add(pid))
    } finally { setBusy(null) }
  }

  const create = async () => {
    const title = newTitle.trim(); if (!title) return
    setBusy('new')
    try {
      const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const { playlist } = await res.json()
      if (playlist) { setPlaylists((p) => [{ id: playlist.id, title: playlist.title }, ...(p ?? [])]); setNewTitle(''); await add(playlist.id) }
    } finally { setBusy(null) }
  }

  return (
    <div className="relative">
      <button onClick={toggleOpen} className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-text hover:border-faint" aria-label="Aggiungi a playlist">
        <ListPlus className="h-4 w-4" /> Playlist
      </button>

      {open && (
        <div className="absolute left-0 top-11 z-30 w-64 overflow-hidden rounded-xl border border-line bg-surface shadow-2xl">
          <div className="border-b border-line p-2">
            <div className="flex items-center gap-2">
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && create()} placeholder="Nuova playlist…" className="w-full rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-sm text-text placeholder-faint focus:border-accent focus:outline-none" />
              <button onClick={create} disabled={busy === 'new'} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-ink" aria-label="Crea">
                {busy === 'new' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {playlists === null ? (
              <p className="px-3 py-4 text-center text-sm text-muted"><Loader2 className="mx-auto h-4 w-4 animate-spin" /></p>
            ) : playlists.length === 0 ? (
              <p className="px-3 py-4 text-center text-sm text-muted">Nessuna playlist ancora.</p>
            ) : playlists.map((pl) => (
              <button key={pl.id} onClick={() => add(pl.id)} disabled={busy === pl.id || added.has(pl.id)} className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm text-text hover:bg-surface-2">
                <span className="truncate">{pl.title}</span>
                {added.has(pl.id) ? <Check className="h-4 w-4 shrink-0 text-accent" /> : busy === pl.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted" /> : <Plus className="h-4 w-4 shrink-0 text-muted" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
