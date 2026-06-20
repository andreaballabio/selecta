'use client'

import { useEffect, useState, useCallback } from 'react'
import { Loader2, Search, Play, Heart, Bookmark, MessageSquare, DownloadCloud, CreditCard, EyeOff, Eye } from 'lucide-react'

interface Track {
  id: string; user_id: string | null
  display_title: string | null; display_artist: string | null
  published: boolean; published_at: string | null
  play_count: number | null; likes_count: number | null; saves_count: number | null; comments_count: number | null
  genre: string | null; sound_bucket: string | null; downloads: number
}
interface Data {
  kpi: { published: number; plays: number; likes: number; saves: number; comments: number; downloads: number; activeSubs: number }
  subsByTier: Record<string, number>
  tracks: Track[]
}

export default function AdminCatalogPage() {
  const [data, setData] = useState<Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [all, setAll] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch(`/api/admin/catalog?all=${all ? 1 : 0}&q=${encodeURIComponent(q)}`, { cache: 'no-store' })
      setData(await r.json())
    } finally { setLoading(false) }
  }, [all, q])
  useEffect(() => { const t = setTimeout(load, 0); return () => clearTimeout(t) }, [load])

  const act = async (id: string, action: 'unpublish' | 'publish') => {
    setBusy(id)
    try { await fetch('/api/admin/catalog', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: id, action }) }); await load() }
    finally { setBusy(null) }
  }

  const k = data?.kpi
  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-3xl font-bold text-text">Catalogo & social</h1>
        <p className="mt-1 text-muted">Gestisci tracce pubblicate, statistiche, download e abbonamenti.</p>
      </header>

      {k && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <Kpi icon={<Eye className="h-4 w-4" />} label="Pubblicate" value={k.published} />
          <Kpi icon={<Play className="h-4 w-4" />} label="Ascolti" value={k.plays} />
          <Kpi icon={<Heart className="h-4 w-4" />} label="Like" value={k.likes} />
          <Kpi icon={<Bookmark className="h-4 w-4" />} label="Salvati" value={k.saves} />
          <Kpi icon={<MessageSquare className="h-4 w-4" />} label="Commenti" value={k.comments} />
          <Kpi icon={<DownloadCloud className="h-4 w-4" />} label="Download" value={k.downloads} />
          <Kpi icon={<CreditCard className="h-4 w-4" />} label="Abbonati" value={k.activeSubs} />
        </div>
      )}

      {data && Object.keys(data.subsByTier).length > 0 && (
        <div className="flex flex-wrap gap-2 text-sm text-muted">
          <span className="text-xs uppercase tracking-wide">Abbonamenti:</span>
          {Object.entries(data.subsByTier).map(([tier, n]) => (
            <span key={tier} className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs text-text">{tier}: {n}</span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cerca per titolo o artista…"
            className="w-full rounded-lg border border-line bg-surface-2 py-2 pl-9 pr-3 text-sm text-text placeholder-faint focus:border-accent focus:outline-none" />
        </div>
        <button onClick={() => setAll((v) => !v)} className={`rounded-lg border px-3 py-2 text-sm font-medium ${all ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-text'}`}>
          {all ? 'Tutte (incl. ritirate)' : 'Solo pubblicate'}
        </button>
      </div>

      {loading ? <p className="py-10 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></p>
      : !data?.tracks?.length ? <p className="py-10 text-center text-muted">Nessuna traccia.</p>
      : (
        <div className="overflow-x-auto rounded-2xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-left text-xs uppercase text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Traccia</th>
                <th className="px-3 py-2 font-medium">▶</th><th className="px-3 py-2 font-medium">♥</th>
                <th className="px-3 py-2 font-medium">⤓</th><th className="px-3 py-2 font-medium">Pubbl.</th>
                <th className="px-3 py-2 font-medium">Azione</th>
              </tr>
            </thead>
            <tbody>
              {data.tracks.map((t) => (
                <tr key={t.id} className="border-t border-line">
                  <td className="px-3 py-2">
                    <div className="font-medium text-text">{t.display_title || '—'}</div>
                    <div className="text-xs text-faint">{t.display_artist || '—'}{t.genre ? ` · ${t.genre}` : ''}{!t.published ? ' · ritirata' : ''}</div>
                  </td>
                  <td className="px-3 py-2 text-muted">{t.play_count ?? 0}</td>
                  <td className="px-3 py-2 text-muted">{t.likes_count ?? 0}</td>
                  <td className="px-3 py-2 text-muted">{t.downloads}</td>
                  <td className="px-3 py-2 text-xs text-faint">{(t.published_at ?? '').slice(0, 10) || '—'}</td>
                  <td className="px-3 py-2">
                    <button onClick={() => act(t.id, t.published ? 'unpublish' : 'publish')} disabled={busy === t.id}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium disabled:opacity-50 ${t.published ? 'border-red-500/40 text-red-400 hover:bg-red-500/10' : 'border-accent/50 text-accent hover:bg-accent/10'}`}>
                      {busy === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t.published ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      {t.published ? 'Ritira' : 'Pubblica'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Kpi({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface/40 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">{icon} {label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-text tabular-nums">{value.toLocaleString('it-IT')}</p>
    </div>
  )
}
