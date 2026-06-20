import { NextRequest, NextResponse } from 'next/server'
import { requireAdminApi } from '@/lib/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

const SELECT = 'id, user_id, display_title, display_artist, published, published_at, play_count, likes_count, saves_count, comments_count, genre, sound_bucket'

/**
 * Gestione completa del catalogo/social per l'admin: KPI, elenco tracce con
 * statistiche, download e abbonamenti. Letture aggregate via service role.
 */
export async function GET(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  const url = new URL(request.url)
  const q = (url.searchParams.get('q') ?? '').trim()
  const all = url.searchParams.get('all') === '1'
  const sb = createAdminClient()

  // Tracce: solo pubblicate (default) o tutte (per ri-pubblicare ciò che è stato ritirato).
  let query = sb.from('user_submissions').select(SELECT).order('published_at', { ascending: false, nullsFirst: false }).limit(300)
  if (!all) query = query.eq('published', true)
  if (q) query = query.or(`display_title.ilike.%${q}%,display_artist.ilike.%${q}%`)
  const { data: tracks } = await query

  // Download → conteggio per traccia + recenti.
  const { data: dls } = await sb.from('downloads').select('submission_id, label, created_at').order('created_at', { ascending: false }).limit(2000)
  const dlByTrack = new Map<string, number>()
  for (const d of dls ?? []) { const sid = (d as { submission_id: string | null }).submission_id; if (sid) dlByTrack.set(sid, (dlByTrack.get(sid) ?? 0) + 1) }

  // Abbonamenti per tier.
  const { data: subs } = await sb.from('subscriptions').select('tier, status')
  const subsByTier: Record<string, number> = {}
  for (const s of subs ?? []) { const r = s as { tier: string; status: string }; if (r.status === 'active') subsByTier[r.tier] = (subsByTier[r.tier] ?? 0) + 1 }

  // KPI globali (sempre calcolati sulle PUBBLICATE).
  const list = (tracks ?? []) as Record<string, unknown>[]
  const pub = list.filter((t) => t.published)
  const sum = (k: string) => pub.reduce((a, t) => a + (typeof t[k] === 'number' ? (t[k] as number) : 0), 0)
  const kpi = {
    published: pub.length,
    plays: sum('play_count'),
    likes: sum('likes_count'),
    saves: sum('saves_count'),
    comments: sum('comments_count'),
    downloads: (dls ?? []).length,
    activeSubs: Object.values(subsByTier).reduce((a, b) => a + b, 0),
  }

  const out = list.map((t) => ({ ...t, downloads: dlByTrack.get(t.id as string) ?? 0 }))
  return NextResponse.json({ kpi, subsByTier, tracks: out })
}

/** Azioni: ritira/pubblica una traccia. */
export async function POST(request: NextRequest) {
  const denied = await requireAdminApi(); if (denied) return denied
  let b: Record<string, unknown> = {}
  try { b = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const id = typeof b.submission_id === 'string' ? b.submission_id : ''
  const action = typeof b.action === 'string' ? b.action : ''
  if (!id || !['unpublish', 'publish'].includes(action)) return NextResponse.json({ error: 'Azione non valida' }, { status: 400 })

  const sb = createAdminClient()
  const patch = action === 'publish'
    ? { published: true, published_at: new Date().toISOString() }
    : { published: false }
  const { error } = await sb.from('user_submissions').update(patch).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // Se ritirata, chiudi eventuali segnalazioni aperte.
  if (action === 'unpublish') await sb.from('track_reports').update({ resolved: true }).eq('submission_id', id).then(() => {}, () => {})
  return NextResponse.json({ ok: true })
}
