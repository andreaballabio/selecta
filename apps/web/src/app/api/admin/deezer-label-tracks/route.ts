import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const dz = (path: string) => fetch(`https://api.deezer.com/${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }).then((r) => r.json())
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

export interface DzTrack {
  deezer_id: string; title: string; artist: string; album: string; release_date: string
  preview_url: string | null; cover: string | null; duration_ms: number; isrc: string | null; already: boolean
}

const norm = (s: string) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** La label dell'album combacia con quella cercata? (tollera varianti/sub-label) */
function labelMatches(albumLabel: string | undefined, target: string): boolean {
  const a = norm(albumLabel || ''), b = norm(target)
  if (!a || !b) return false
  return a === b || (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a)))
}

const EDIT_ONLY = /^(original mix|extended mix|radio edit|radio mix|club mix|extended|original|edit|vocal mix|instrumental|short edit|intro edit|intro|outro)$/i
/** Chiave per collassare le versioni-edit della stessa traccia (tiene distinti i remix). */
function titleKey(title: string): string {
  let t = title.toLowerCase()
  t = t.replace(/[([]([^)\]]+)[)\]]/g, (m, inner) => {
    const seg = (inner as string).trim()
    if (/^feat/.test(seg)) return ' '
    if (/\b(remix|rework|re-?edit|dub|flip|bootleg|version|vip|refix|mashup)\b/i.test(seg)) return m // opere distinte → tieni
    if (EDIT_ONLY.test(seg)) return ' '
    return m
  })
  t = t.replace(/\s[-–]\s*(extended mix|original mix|radio edit|club mix|extended|original|edit|instrumental).*$/i, '')
  t = t.replace(/\bfeat\.?\b.*$/i, '')
  return norm(t)
}

export async function GET(request: NextRequest) {
  const label = (new URL(request.url).searchParams.get('label') ?? '').trim()
  if (!label) return NextResponse.json({ error: 'label richiesta' }, { status: 400 })
  const q = encodeURIComponent(`"${label}"`)

  // 1) Lista album (paginata) — molti più di prima
  const albumIds: number[] = []
  let totalAlbums = 0
  for (const index of [0, 100, 200]) {
    const res = await dz(`search/album?q=label:${q}&limit=100&index=${index}`)
    totalAlbums = res?.total ?? totalAlbums
    for (const a of (res?.data ?? [])) albumIds.push(a.id)
    if (!res?.next || albumIds.length >= 200) break
  }
  const cappedAlbums = albumIds.slice(0, 180)

  // 2) Dettagli album a blocchi (throttle anti-ban) → tracce grezze
  const raw: DzTrack[] = []
  const seen = new Set<string>()
  for (let i = 0; i < cappedAlbums.length; i += 8) {
    const details = await Promise.all(cappedAlbums.slice(i, i + 8).map((id) => dz(`album/${id}`).catch(() => null)))
    for (const d of details) {
      if (!d || !labelMatches(d.label, label)) continue
      const cover = d.cover_medium ?? d.cover ?? null
      for (const t of (d.tracks?.data ?? [])) {
        const id = String(t.id)
        if (seen.has(id)) continue
        seen.add(id)
        raw.push({
          deezer_id: id, title: t.title, artist: t.artist?.name ?? d.artist?.name ?? '',
          album: d.title, release_date: d.release_date ?? '', preview_url: t.preview || null,
          cover, duration_ms: (t.duration ?? 0) * 1000, isrc: t.isrc ?? null, already: false,
        })
      }
    }
    if (i + 8 < cappedAlbums.length) await sleep(120)
  }

  // 3) Dedup intelligente: collassa le versioni-edit, tieni la più lunga con preview
  const byKey = new Map<string, DzTrack>()
  for (const t of raw) {
    const key = `${titleKey(t.title)}|${norm(t.artist).split(' ').slice(0, 4).join(' ')}`
    const cur = byKey.get(key)
    if (!cur) { byKey.set(key, t); continue }
    const better = (!!t.preview_url !== !!cur.preview_url) ? !!t.preview_url : t.duration_ms > cur.duration_ms
    if (better) byKey.set(key, t)
  }
  let tracks = [...byKey.values()].sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? '')).slice(0, 400)

  // 4) Segna le già presenti (label Selecta per nome, confronto per id Deezer)
  if (tracks.length) {
    const sb = createAdminClient()
    const { data: lab } = await sb.from('labels').select('id').ilike('name', label).maybeSingle()
    const labId = (lab as { id: string } | null)?.id
    if (labId) {
      const { data } = await sb.from('label_ingestion_queue').select('source_id').eq('label_id', labId)
      const have = new Set((data ?? []).map((r) => (r as { source_id: string | null }).source_id).filter(Boolean))
      for (const t of tracks) if (have.has(t.deezer_id)) t.already = true
    }
  }

  return NextResponse.json({ tracks, count: tracks.length, total_albums: totalAlbums })
}
