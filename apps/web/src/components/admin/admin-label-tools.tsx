'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, Save, RefreshCw, Play, Pause, ExternalLink } from 'lucide-react'

interface Meta {
  accepts_unsolicited_demos: boolean | null
  demo_submission_url: string | null
  website_url: string | null
  response_time_days_avg: number | null
  target_artist_level: string | null
  reachability_score?: number | null
  openness_score?: number | null
  release_cadence_12mo?: number | null
  reference_artists?: string[] | null
  last_release_date?: string | null
  scores_updated_at?: string | null
}
interface Demo { id: string; title: string; artist: string; file_url: string | null; score: number; best_track: string | null; is_top: boolean }

export function AdminLabelTools({ labelId }: { labelId: string }) {
  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <ARForm labelId={labelId} />
      <IncomingDemos labelId={labelId} />
    </div>
  )
}

function ARForm({ labelId }: { labelId: string }) {
  const [m, setM] = useState<Meta | null>(null)
  const [saving, setSaving] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = () => fetch(`/api/admin/label-meta?id=${labelId}`).then((r) => r.json()).then((d) => setM(d.label ?? null)).catch(() => {})
  useEffect(() => { load() }, [labelId])

  const set = (k: keyof Meta, v: any) => setM((p) => (p ? { ...p, [k]: v } : p))

  const save = async () => {
    if (!m) return
    setSaving(true); setMsg('')
    try {
      const r = await fetch('/api/admin/label-meta', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: labelId, accepts_unsolicited_demos: m.accepts_unsolicited_demos, demo_submission_url: m.demo_submission_url, website_url: m.website_url, response_time_days_avg: m.response_time_days_avg, target_artist_level: m.target_artist_level }) })
      setMsg(r.ok ? '✓ Salvato' : '✗ Errore')
    } finally { setSaving(false) }
  }
  const recompute = async () => {
    setRecomputing(true); setMsg('')
    try {
      const r = await fetch('/api/admin/recompute-scores', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label_id: labelId }) })
      setMsg(r.ok ? '✓ Punteggi ricalcolati' : '✗ Errore (hai applicato la migrazione 0013?)')
      await load()
    } finally { setRecomputing(false) }
  }

  return (
    <section className="rounded-lg border border-line bg-surface-2/50 p-4">
      <h3 className="mb-3 font-semibold text-text">A&amp;R / Invio demo</h3>
      {!m ? <div className="py-6 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div> : (
        <div className="space-y-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={!!m.accepts_unsolicited_demos} onChange={(e) => set('accepts_unsolicited_demos', e.target.checked)} className="h-4 w-4 accent-[var(--accent)]" />
            <span className="text-text">Accetta demo non sollecitate</span>
          </label>
          <Field label="Link invio demo" value={m.demo_submission_url ?? ''} onChange={(v) => set('demo_submission_url', v)} placeholder="https://label.com/demos" />
          <Field label="Sito web" value={m.website_url ?? ''} onChange={(v) => set('website_url', v)} placeholder="https://label.com" />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Risposta (giorni)" value={m.response_time_days_avg?.toString() ?? ''} onChange={(v) => set('response_time_days_avg', v ? Number(v) : null)} placeholder="14" />
            <div>
              <p className="mb-1 text-xs text-muted">Livello artisti</p>
              <select value={m.target_artist_level ?? ''} onChange={(e) => set('target_artist_level', e.target.value || null)} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-text focus:border-accent focus:outline-none">
                <option value="">—</option>
                <option value="emerging">Emergenti</option>
                <option value="established">Affermati</option>
                <option value="mixed">Misto</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button onClick={save} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink disabled:opacity-50">{saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Salva</button>
            <button onClick={recompute} disabled={recomputing} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-medium text-text hover:border-accent disabled:opacity-50">{recomputing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Ricalcola punteggi</button>
            {msg && <span className={`text-xs ${msg.startsWith('✓') ? 'text-accent' : 'text-red-400'}`}>{msg}</span>}
          </div>

          {/* Punteggi calcolati (read-only) */}
          <div className="mt-2 rounded-lg bg-surface p-3 text-xs">
            <p className="mb-1 font-semibold uppercase tracking-wider text-faint">Calcolati dai dati</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted">
              <span>reachability <span className="text-text">{m.reachability_score ?? '—'}</span></span>
              <span>apertura <span className="text-text">{m.openness_score ?? '—'}</span></span>
              <span>uscite/12m <span className="text-text">{m.release_cadence_12mo ?? '—'}</span></span>
              <span>ultima uscita <span className="text-text">{m.last_release_date ?? '—'}</span></span>
            </div>
            {(m.reference_artists?.length ?? 0) > 0 && <p className="mt-1 text-faint">artisti: <span className="text-muted">{m.reference_artists!.join(', ')}</span></p>}
          </div>
        </div>
      )}
    </section>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted">{label}</p>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-text placeholder-faint focus:border-accent focus:outline-none" />
    </div>
  )
}

function IncomingDemos({ labelId }: { labelId: string }) {
  const [demos, setDemos] = useState<Demo[] | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => { fetch(`/api/admin/incoming-demos?label_id=${labelId}`).then((r) => r.json()).then((d) => setDemos(d.demos ?? [])).catch(() => setDemos([])) }, [labelId])

  const toggle = (id: string, url: string | null) => {
    if (!url) return
    if (!audioRef.current) audioRef.current = new Audio()
    const a = audioRef.current
    if (playing === id) { a.pause(); setPlaying(null); return }
    a.src = url; a.play().catch(() => {}); a.onended = () => setPlaying(null); setPlaying(id)
  }

  return (
    <section className="rounded-lg border border-line bg-surface-2/50 p-4">
      <h3 className="mb-1 font-semibold text-text">Demo che suonano come questa label</h3>
      <p className="mb-3 text-xs text-muted">Le tracce utente più compatibili col vostro suono, ordinate per somiglianza.</p>
      {demos == null ? <div className="py-6 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></div>
        : demos.length === 0 ? <p className="py-6 text-center text-sm text-muted">Ancora nessuna demo compatibile.</p>
        : (
          <div className="max-h-[22rem] divide-y divide-line overflow-auto">
            {demos.map((d) => (
              <div key={d.id} className="flex items-center gap-3 py-2">
                <button onClick={() => toggle(d.id, d.file_url)} disabled={!d.file_url} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-text hover:bg-accent hover:text-accent-ink disabled:opacity-40">
                  {playing === d.id ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{d.title}</p>
                  <p className="truncate text-xs text-muted">{d.artist}{d.best_track && <span className="text-faint"> · vicino a {d.best_track}</span>}</p>
                </div>
                {d.is_top && <span className="shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-medium text-accent">top match</span>}
                <span className="w-10 shrink-0 text-right text-sm font-semibold text-accent">{Math.round(d.score * 100)}%</span>
              </div>
            ))}
          </div>
        )}
    </section>
  )
}
