import type { Metadata } from 'next'
import Link from 'next/link'
import { Users, Sparkles } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { deriveSoundDna } from '@/lib/sound-dna'
import { parseEmbedding, cosine, centroid } from '@/lib/embedding'
import { ArtistsList, type ArtistItem } from '@/components/social/artists-list'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Artisti — Selecta',
  description: 'Scopri i producer di Tech House e trova chi suona come te.',
}

interface ProfileRow {
  user_id: string
  handle: string | null
  display_name: string | null
  tagline: string | null
  photo_url: string | null
  bpm_range: string | null
}
interface SubRow {
  user_id: string
  audio_embedding: unknown
  bpm: number | null
  sub_ratio: number | null
  mid_presence: number | null
  spectral_centroid: number | null
  onset_strength: number | null
}

export default async function ArtistsPage() {
  const admin = createAdminClient()
  const ssr = await createSsrClient()
  const { data: { user: viewer } } = await ssr.auth.getUser()

  const [{ data: profs }, { data: subs }] = await Promise.all([
    admin.from('artist_profiles').select('user_id, handle, display_name, tagline, photo_url, bpm_range'),
    admin.from('user_submissions')
      .select('user_id, audio_embedding, bpm, sub_ratio, mid_presence, spectral_centroid, onset_strength')
      .eq('analysis_status', 'analyzed')
      .not('user_id', 'is', null)
      .limit(3000),
  ])

  // Raggruppa le analisi per artista → centroide + Sound DNA.
  const byUser = new Map<string, SubRow[]>()
  for (const s of (subs ?? []) as SubRow[]) {
    if (!s.user_id) continue
    const arr = byUser.get(s.user_id) ?? []
    arr.push(s); byUser.set(s.user_id, arr)
  }
  const centroidOf = new Map<string, number[]>()
  for (const [uid, rows] of byUser) {
    centroidOf.set(uid, centroid(rows.map((r) => parseEmbedding(r.audio_embedding))))
  }

  const myCentroid = viewer ? centroidOf.get(viewer.id) ?? null : null

  const items: ArtistItem[] = ((profs ?? []) as ProfileRow[]).map((p) => {
    const rows = byUser.get(p.user_id) ?? []
    const dna = deriveSoundDna(rows)
    const c = centroidOf.get(p.user_id)
    const affinity = myCentroid && c && c.length ? Math.max(0, cosine(myCentroid, c)) : undefined
    return {
      user_id: p.user_id,
      handle: p.handle,
      display_name: p.display_name,
      tagline: p.tagline,
      photo_url: p.photo_url,
      descriptors: dna?.descriptors ?? [],
      bpmRange: dna?.bpmRange ?? p.bpm_range ?? null,
      trackCount: rows.length,
      affinity,
    }
  })

  // "Simili a te": altri artisti con centroide, ordinati per affinità.
  const similar = myCentroid
    ? items.filter((a) => a.user_id !== viewer!.id && a.affinity !== undefined)
        .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0))
        .slice(0, 6)
    : []

  // Directory: per numero di tracce (più attivi prima), senza badge affinità.
  const directory = [...items]
    .sort((a, b) => b.trackCount - a.trackCount)
    .map((a) => ({ ...a, affinity: undefined }))

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <header className="mb-8">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1">
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Artisti</span>
          </div>
          <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">Chi fa Tech House qui</h1>
          <p className="mt-2 text-zinc-400">Scopri i producer e — se hai analizzato le tue tracce — trova chi suona come te.</p>
        </header>

        {similar.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-500/80">
              <Sparkles className="h-3.5 w-3.5" /> Simili a te
            </h2>
            <ArtistsList artists={similar} />
          </section>
        )}

        {!viewer && (
          <div className="mb-8 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5 text-center text-sm text-zinc-400">
            <Link href="/match" className="font-semibold text-emerald-400 hover:underline">Analizza le tue tracce</Link> per scoprire gli artisti che suonano come te.
          </div>
        )}

        <section>
          {similar.length > 0 && <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Tutti gli artisti</h2>}
          <ArtistsList artists={directory} />
        </section>
      </div>
    </div>
  )
}
