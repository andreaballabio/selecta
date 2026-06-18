import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

interface InTrack { deezer_id: string; title: string; artist: string; album: string; release_date: string; preview_url: string | null; cover: string | null; duration_ms: number }

/** Crea/riusa la label e accoda le tracce Deezer (già matchate) per l'analisi. */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!isAdminEmail(user?.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let labelName = '', labelId = '', primaryGenre = '', tracks: InTrack[] = []
  try {
    const b = await request.json()
    labelName = (b.label_name ?? '').trim()
    labelId = b.label_id ?? ''
    primaryGenre = b.primary_genre ?? ''
    tracks = Array.isArray(b.tracks) ? b.tracks : []
  } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const sb = createAdminClient()

  // Risolvi/crea la label
  if (!labelId) {
    if (!labelName) return NextResponse.json({ error: 'label richiesta' }, { status: 400 })
    const { data: existing } = await sb.from('labels').select('id').ilike('name', labelName).maybeSingle()
    if (existing) labelId = (existing as { id: string }).id
    else {
      const { data: created, error } = await sb.from('labels')
        .insert({ name: labelName, slug: slugify(labelName), source: 'deezer', primary_genre: primaryGenre || null, cataloged_tracks: 0 })
        .select('id').single()
      if (error || !created) return NextResponse.json({ error: 'Creazione label fallita' }, { status: 500 })
      labelId = (created as { id: string }).id
    }
  }

  // Evita doppioni (per id Deezer già in coda)
  const { data: existRows } = await sb.from('label_ingestion_queue').select('source_id').eq('label_id', labelId)
  const have = new Set((existRows ?? []).map((r) => (r as { source_id: string | null }).source_id).filter(Boolean))

  const rows = tracks
    .filter((t) => t.preview_url && !have.has(t.deezer_id))
    .map((t) => ({
      label_id: labelId, track_title: t.title, artist_name: t.artist,
      source: 'deezer', source_id: t.deezer_id, source_url: `https://www.deezer.com/track/${t.deezer_id}`,
      status: 'matched', audio_source: 'deezer', audio_preview_url: t.preview_url,
      spotify_track_id: t.deezer_id, spotify_track_name: t.title, spotify_artist_name: t.artist,
      spotify_album_name: t.album, spotify_album_image: t.cover, spotify_duration_ms: t.duration_ms,
      spotify_url: `https://www.deezer.com/track/${t.deezer_id}`, spotify_match_confidence: 1.0,
      release_date: t.release_date || null, analysis_status: 'pending', attempts: 0, max_attempts: 3,
    }))

  if (rows.length) {
    const { error } = await sb.from('label_ingestion_queue').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Allinea il contatore al numero reale di tracce in coda
  const { count } = await sb.from('label_ingestion_queue').select('id', { count: 'exact', head: true }).eq('label_id', labelId)
  await sb.from('labels').update({ cataloged_tracks: count ?? 0 }).eq('id', labelId)

  return NextResponse.json({ label_id: labelId, added: rows.length, skipped: tracks.length - rows.length })
}
