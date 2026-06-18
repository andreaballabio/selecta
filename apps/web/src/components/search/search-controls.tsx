'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { BUCKETS } from '@/lib/sound-bucket'

const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const SORTS = [{ v: 'hot', l: 'Di tendenza' }, { v: 'new', l: 'Novità' }, { v: 'plays', l: 'Più ascoltate' }]

export function SearchControls() {
  const router = useRouter()
  const sp = useSearchParams()
  const [q, setQ] = useState(sp.get('q') ?? '')

  // debounce del testo → aggiorna URL
  useEffect(() => {
    const id = setTimeout(() => {
      const cur = sp.get('q') ?? ''
      if (q !== cur) push({ q: q || null })
    }, 350)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const push = (patch: Record<string, string | null>) => {
    const params = new URLSearchParams(Array.from(sp.entries()))
    for (const [k, v] of Object.entries(patch)) { if (v == null || v === '') params.delete(k); else params.set(k, v) }
    router.push(`/search${params.toString() ? `?${params}` : ''}`)
  }

  const get = (k: string) => sp.get(k) ?? ''
  const hasFilters = ['bucket', 'key', 'bpmMin', 'bpmMax', 'sort'].some((k) => sp.get(k)) || q

  const sel = 'rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text focus:border-accent focus:outline-none'

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-faint" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cerca tracce, artisti…"
          className="w-full rounded-xl border border-line bg-surface-2 py-3.5 pl-12 pr-4 text-text placeholder-faint focus:border-accent focus:outline-none"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select className={sel} value={get('bucket')} onChange={(e) => push({ bucket: e.target.value || null })}>
          <option value="">Tutti i sottogeneri</option>
          {BUCKETS.map((b) => <option key={b.key} value={b.key}>{b.label}</option>)}
        </select>

        <select className={sel} value={get('key')} onChange={(e) => push({ key: e.target.value || null })}>
          <option value="">Tutte le key</option>
          {KEYS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>

        <div className="flex items-center gap-1.5">
          <input type="number" inputMode="numeric" placeholder="BPM min" defaultValue={get('bpmMin')} onBlur={(e) => push({ bpmMin: e.target.value || null })} className={`${sel} w-24`} />
          <span className="text-faint">–</span>
          <input type="number" inputMode="numeric" placeholder="max" defaultValue={get('bpmMax')} onBlur={(e) => push({ bpmMax: e.target.value || null })} className={`${sel} w-20`} />
        </div>

        <select className={sel} value={get('sort') || 'hot'} onChange={(e) => push({ sort: e.target.value })}>
          {SORTS.map((s) => <option key={s.v} value={s.v}>{s.l}</option>)}
        </select>

        {hasFilters && (
          <button onClick={() => { setQ(''); router.push('/search') }} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-muted hover:text-text">
            <X className="h-4 w-4" /> Azzera
          </button>
        )}
      </div>
    </div>
  )
}
