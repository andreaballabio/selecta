'use client'

import { useState } from 'react'
import { Play, Pause, Layers, Plus, Trash2, Loader2 } from 'lucide-react'
import { AudioUpload } from '@/components/upload/audio-upload'
import { createClient } from '@/lib/supabase/client'
import { usePlayer } from '@/components/player/player-context'

export interface TrackVersion { id: string; label: string; file_url: string }

const LABELS = ['Extended', 'Intro/Outro', 'Radio Edit', 'Clean', 'Dirty', 'Acapella', 'Acapella Out', 'Instrumental', 'Transition', 'Quick Hitter']

export function TrackVersions({
  submissionId, trackTitle, trackArtist, trackCover, initial, isOwner,
}: { submissionId: string; trackTitle: string | null; trackArtist: string | null; trackCover: string | null; initial: TrackVersion[]; isOwner: boolean }) {
  const player = usePlayer()
  const [versions, setVersions] = useState<TrackVersion[]>(initial)
  const [label, setLabel] = useState(LABELS[0])
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const play = (v: TrackVersion) => {
    const pid = `${submissionId}:${v.id}`
    if (player.current?.id === pid) { player.togglePlay(); return }
    player.playQueue([{ id: pid, title: `${trackTitle ?? 'Traccia'} — ${v.label}`, artist: trackArtist, cover_url: trackCover, file_url: v.file_url }], 0)
  }

  const onUploaded = async (path: string) => {
    setAdding(true)
    try {
      const sb = createClient()
      const { data: { publicUrl } } = sb.storage.from('audio-tracks').getPublicUrl(path)
      const res = await fetch('/api/catalog/versions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId, label, file_url: publicUrl }) })
      const d = await res.json()
      if (d.version) { setVersions((vs) => [...vs, d.version]); setShowAdd(false) }
    } finally { setAdding(false) }
  }

  const remove = async (id: string) => {
    setVersions((vs) => vs.filter((v) => v.id !== id))
    fetch('/api/catalog/versions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ version_id: id }) }).catch(() => {})
  }

  if (versions.length === 0 && !isOwner) return null

  return (
    <section className="mt-8 rounded-2xl border border-line bg-surface/40 p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted"><Layers className="h-4 w-4" /> Versioni</h2>

      {versions.length > 0 ? (
        <div className="space-y-1">
          {versions.map((v) => {
            const pid = `${submissionId}:${v.id}`
            const isPlaying = player.current?.id === pid && player.playing
            return (
              <div key={v.id} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/60">
                <button onClick={() => play(v)} className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-accent-ink" aria-label={isPlaying ? 'Pausa' : 'Play'}>
                  {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
                </button>
                <span className="flex-1 text-sm font-medium text-text">{v.label}</span>
                {isOwner && <button onClick={() => remove(v.id)} className="text-faint hover:text-red-400" aria-label="Rimuovi"><Trash2 className="h-4 w-4" /></button>}
              </div>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted">Nessuna versione alternativa. {isOwner && 'Aggiungine una (Extended, Acapella, Clean…).'}</p>
      )}

      {isOwner && (
        <div className="mt-3 border-t border-line pt-3">
          {!showAdd ? (
            <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm text-accent hover:underline"><Plus className="h-4 w-4" /> Aggiungi versione</button>
          ) : (
            <div className="space-y-3">
              <select value={label} onChange={(e) => setLabel(e.target.value)} className="rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none">
                {LABELS.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
              {adding ? (
                <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="h-4 w-4 animate-spin" /> Aggiunta versione…</p>
              ) : (
                <AudioUpload onUploadComplete={(path) => onUploaded(path)} onError={() => {}} />
              )}
              <button onClick={() => setShowAdd(false)} className="text-xs text-muted hover:text-text">Annulla</button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
