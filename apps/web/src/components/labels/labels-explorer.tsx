'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, Upload, Mail, CheckCircle2, Sparkles } from 'lucide-react'
import { difficultyMeta, toneClass, featureBars, soundTags, relativeDate } from '@/lib/label-display'
import { parseSoundQuery, scoreLabel } from '@/lib/sound-language'

export interface DirLabel {
  id: string; name: string; slug: string | null; primary_genre: string | null
  secondary_genres?: string[] | null
  cataloged_tracks: number | null; accepts_unsolicited_demos: boolean | null
  reachability_score: number | null; openness_score: number | null
  release_cadence_12mo: number | null; reference_artists: string[] | null; last_release_date: string | null
  profile: Record<string, any> | null
}

type Sort = 'tracce' | 'attivita' | 'apertura' | 'nome'

export function LabelsExplorer({ labels }: { labels: DirLabel[] }) {
  const [q, setQ] = useState('')
  const [genre, setGenre] = useState('')
  const [diff, setDiff] = useState('')
  const [demosOnly, setDemosOnly] = useState(false)
  const [sort, setSort] = useState<Sort>('tracce')

  const genres = useMemo(() => [...new Set(labels.map((l) => l.primary_genre).filter(Boolean))] as string[], [labels])

  // Ranking per affinità (gratis, lato client): parole → assi misurati. Quando
  // c'è una query, ogni label riceve un punteggio e ordiniamo per pertinenza.
  const { filtered, scores } = useMemo(() => {
    const parsed = parseSoundQuery(q)
    const hasQuery = parsed.tokens.length > 0
    const scores = new Map<string, number>()

    let list = labels.filter((l) => {
      if (genre && l.primary_genre !== genre) return false
      if (demosOnly && !l.accepts_unsolicited_demos) return false
      if (diff) { const d = difficultyMeta(l.reachability_score).label.toLowerCase(); if (d !== diff) return false }
      if (hasQuery) {
        const s = scoreLabel(parsed, l)
        if (s == null) return false
        scores.set(l.id, s)
      }
      return true
    })

    if (hasQuery) {
      list = [...list].sort((a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0))
    } else {
      list = [...list].sort((a, b) => {
        if (sort === 'nome') return a.name.localeCompare(b.name)
        if (sort === 'attivita') return (b.release_cadence_12mo ?? 0) - (a.release_cadence_12mo ?? 0)
        if (sort === 'apertura') return (b.openness_score ?? -1) - (a.openness_score ?? -1)
        return (b.cataloged_tracks ?? 0) - (a.cataloged_tracks ?? 0)
      })
    }
    return { filtered: list, scores }
  }, [labels, q, genre, diff, demosOnly, sort])

  const ranked = scores.size > 0
  const maxScore = ranked ? Math.max(...filtered.map((l) => scores.get(l.id) ?? 0), 0.0001) : 0

  return (
    <div className="space-y-6">
      {/* Porta d'ingresso: descrivi a parole + upsell al match vero */}
      <div className="rounded-2xl border border-line bg-surface/60 p-4 sm:p-5">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <input
            value={q} onChange={(e) => setQ(e.target.value)}
            placeholder="Descrivi il tuo suono… (es. «tech house scura con sub pesante», «melodic caldo e ipnotico»)"
            className="w-full rounded-xl border border-line bg-surface-2 py-3 pl-10 pr-3 text-text placeholder-faint focus:border-accent focus:outline-none"
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted">
            {ranked
              ? <span className="inline-flex items-center gap-1 text-accent"><Sparkles className="h-3.5 w-3.5" /> Ordinate per affinità col tuo suono</span>
              : <>Cerca descrivendo il tuo suono. <span className="text-faint">Il match più preciso lo dà la tua traccia →</span></>}
          </p>
          <Link href="/match" className="inline-flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink">
            <Upload className="h-4 w-4" /> Match vero con la tua traccia
          </Link>
        </div>
      </div>

      {/* Filtri */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select value={genre} onChange={(e) => setGenre(e.target.value)} className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-text focus:border-accent focus:outline-none">
          <option value="">Tutti i generi</option>
          {genres.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={diff} onChange={(e) => setDiff(e.target.value)} className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-text focus:border-accent focus:outline-none">
          <option value="">Ogni difficoltà</option>
          <option value="accessibile">Accessibile</option>
          <option value="media">Media</option>
          <option value="difficile">Difficile</option>
        </select>
        <button onClick={() => setDemosOnly((v) => !v)} className={`rounded-lg border px-3 py-1.5 font-medium transition-colors ${demosOnly ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line text-muted hover:text-text'}`}>
          Accetta demo
        </button>
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span>Ordina</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} disabled={ranked} className="rounded-lg border border-line bg-surface-2 px-2 py-1.5 text-text focus:border-accent focus:outline-none disabled:opacity-50">
            <option value="tracce">Più tracce</option>
            <option value="attivita">Più attive</option>
            <option value="apertura">Più aperte ai nuovi</option>
            <option value="nome">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      <p className="text-xs text-muted">{filtered.length} label</p>

      {/* Griglia */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((l) => <LabelCard key={l.id} l={l} affinity={ranked ? Math.round(((scores.get(l.id) ?? 0) / maxScore) * 100) : null} />)}
        {filtered.length === 0 && <p className="col-span-full py-12 text-center text-muted">Nessuna label con questi filtri.</p>}
      </div>
    </div>
  )
}

function LabelCard({ l, affinity }: { l: DirLabel; affinity: number | null }) {
  const dm = difficultyMeta(l.reachability_score)
  const bars = featureBars(l.profile).slice(0, 3)
  const tags = soundTags(l.profile)
  return (
    <Link href={`/labels/${l.slug || l.id}`} className="group flex flex-col gap-3 rounded-2xl border border-line bg-surface/50 p-4 transition-colors hover:border-faint">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base font-bold text-text group-hover:text-accent">{l.name}</h3>
          <p className="text-xs text-muted">{l.primary_genre || '—'} · {l.cataloged_tracks ?? 0} tracce</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {affinity != null && <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent"><Sparkles className="h-3 w-3" /> {affinity}%</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneClass[dm.tone]}`}>{dm.label}</span>
        </div>
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] text-muted">{t}</span>)}
        </div>
      )}

      {bars.length > 0 && (
        <div className="space-y-1.5">
          {bars.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] text-faint">{b.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-accent/70" style={{ width: `${b.pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between gap-2 pt-1 text-[11px] text-muted">
        <span className="inline-flex items-center gap-1">
          {l.accepts_unsolicited_demos ? <><CheckCircle2 className="h-3.5 w-3.5 text-accent" /> accetta demo</> : <><Mail className="h-3.5 w-3.5 text-faint" /> su invito</>}
        </span>
        <span>ultima uscita {relativeDate(l.last_release_date)}</span>
      </div>
    </Link>
  )
}
