import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const dz = (path: string) => fetch(`https://api.deezer.com/${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(15000) }).then((r) => r.json())

export interface DzTrack {
  deezer_id: string; title: string; artist: string; album: string; release_date: string
  preview_url: string | null; cover: string | null; duration_ms: number; isrc: string | null; already: boolean
}

/**
 * Tracce di una label (stringa esatta) da Deezer, IN ORDINE DI USCITA. Espande gli
 * album → tracce, dedup per id Deezer, e segna quelle già presenti in Selecta.
 */
export async function GET(request: NextRequest) {
  const sp = new URL(request.url).searchParams
  const label = (sp.get('label') ?? '').trim()
  if (!label) return NextResponse.json({ error: 'label richiesta' }, { status: 400 })

  const res = await dz(`search/album?q=label:${encodeURIComponent(`"${label}"`)}&limit=100`)
  const albums: { id: number }[] = (res?.data ?? []).slice(0, 35)

  const tracks: DzTrack[] = []
  const seen = new Set<string>()
  for (let i = 0; i < albums.length; i += 6) {
    const details = await Promise.all(albums.slice(i, i + 6).map((a) => dz(`album/${a.id}`).catch(() => null)))
    for (const d of details) {
      if (!d || d.label !== label) continue // tieni solo la label esatta (riduce il rumore)
      const cover = d.cover_medium ?? d.cover ?? null
      for (const t of (d.tracks?.data ?? [])) {
        const id = String(t.id)
        if (seen.has(id)) continue
        seen.add(id)
        tracks.push({
          deezer_id: id, title: t.title, artist: t.artist?.name ?? d.artist?.name ?? '',
          album: d.title, release_date: d.release_date ?? '', preview_url: t.preview || null,
          cover, duration_ms: (t.duration ?? 0) * 1000, isrc: t.isrc ?? null, already: false,
        })
      }
    }
  }

  tracks.sort((a, b) => (b.release_date ?? '').localeCompare(a.release_date ?? ''))
  const capped = tracks.slice(0, 150)

  // Segna quelle già in coda: trova la label Selecta per nome e confronta gli id Deezer
  if (capped.length) {
    const sb = createAdminClient()
    const { data: lab } = await sb.from('labels').select('id').ilike('name', label).maybeSingle()
    const labId = (lab as { id: string } | null)?.id
    if (labId) {
      const { data } = await sb.from('label_ingestion_queue').select('source_id').eq('label_id', labId)
      const have = new Set((data ?? []).map((r) => (r as { source_id: string | null }).source_id).filter(Boolean))
      for (const t of capped) if (have.has(t.deezer_id)) t.already = true
    }
  }

  return NextResponse.json({ tracks: capped, count: capped.length, total_albums: res?.total ?? albums.length })
}
