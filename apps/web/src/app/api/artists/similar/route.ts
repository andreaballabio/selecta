import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { nearestPeers, type PeerTrack } from '@/lib/peer-graph'

export const dynamic = 'force-dynamic'

function parseEmb(raw: unknown): number[] {
  if (typeof raw === 'string') { try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map(Number) : [] } catch { return [] } }
  if (Array.isArray(raw)) return (raw as unknown[]).map(Number)
  return []
}

/**
 * "Producer che suonano come questo artista" — grafo per suono dagli embedding
 * delle tracce pubblicate. Pubblico (dati aggregati via service role).
 */
export async function GET(request: NextRequest) {
  const userId = new URL(request.url).searchParams.get('user') ?? ''
  if (!userId) return NextResponse.json({ error: 'user richiesto' }, { status: 400 })

  const sb = createAdminClient()

  // Embedding dell'artista target (sue tracce analizzate).
  const { data: mine } = await sb.from('user_submissions')
    .select('audio_embedding').eq('user_id', userId).eq('analysis_status', 'analyzed')
    .not('audio_embedding', 'is', null).limit(50)
  const targets = (mine ?? []).map((r) => parseEmb((r as { audio_embedding: unknown }).audio_embedding)).filter((e) => e.length === 64)
  if (targets.length === 0) return NextResponse.json({ peers: [] })

  // Candidati: tracce pubblicate da chiunque.
  const { data: pub } = await sb.from('user_submissions')
    .select('user_id, display_artist, display_title, audio_embedding')
    .eq('published', true).eq('analysis_status', 'analyzed').not('audio_embedding', 'is', null).limit(3000)
  const candidates: PeerTrack[] = (pub ?? []).map((r) => {
    const row = r as { user_id: string; display_artist: string | null; display_title: string | null; audio_embedding: unknown }
    return { userId: row.user_id, artist: row.display_artist, trackTitle: row.display_title, embedding: parseEmb(row.audio_embedding) }
  }).filter((c) => c.userId && c.embedding.length === 64)

  const peers = nearestPeers(targets, candidates, { excludeUserIds: [userId], k: 8, minScore: 0.05 })
  if (peers.length === 0) return NextResponse.json({ peers: [] })

  // Solo chi ha una press kit pubblica (linkabile) → rafforza l'identità.
  const ids = peers.map((p) => p.userId)
  const { data: profiles } = await sb.from('artist_profiles').select('user_id, handle, display_name').in('user_id', ids)
  const byId = new Map((profiles ?? []).map((pr) => [(pr as { user_id: string }).user_id, pr as { handle: string; display_name: string }]))

  const out = peers
    .map((p) => {
      const pr = byId.get(p.userId)
      return pr?.handle ? { handle: pr.handle, name: pr.display_name || p.artist || 'Producer', affinity: Math.max(0, Math.round(p.score * 100)) } : null
    })
    .filter((x): x is { handle: string; name: string; affinity: number } => x !== null)

  return NextResponse.json({ peers: out })
}
