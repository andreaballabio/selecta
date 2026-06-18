'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Globe, Lock, Trash2 } from 'lucide-react'

export function PlaylistOwnerControls({ playlistId, isPublic }: { playlistId: string; isPublic: boolean }) {
  const router = useRouter()
  const [pub, setPub] = useState(isPublic)

  const patch = (body: Record<string, unknown>) =>
    fetch(`/api/playlists/${playlistId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

  const rename = async () => {
    const t = window.prompt('Nuovo titolo della playlist')
    if (t && t.trim()) { await patch({ title: t.trim() }); router.refresh() }
  }
  const toggle = async () => { const np = !pub; setPub(np); await patch({ is_public: np }); router.refresh() }
  const del = async () => {
    if (!window.confirm('Eliminare definitivamente la playlist?')) return
    await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' })
    router.push('/dashboard'); router.refresh()
  }

  const btn = 'flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-text hover:border-faint'
  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={rename} className={btn}><Pencil className="h-4 w-4" /> Rinomina</button>
      <button onClick={toggle} className={btn}>{pub ? <Globe className="h-4 w-4 text-accent" /> : <Lock className="h-4 w-4" />} {pub ? 'Pubblica' : 'Privata'}</button>
      <button onClick={del} className="flex items-center gap-1.5 rounded-full border border-line px-3.5 py-1.5 text-sm text-red-400 hover:border-red-500/40"><Trash2 className="h-4 w-4" /> Elimina</button>
    </div>
  )
}
