import Link from 'next/link'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { bucketByKey } from '@/lib/sound-bucket'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count'

function parseEmbedding(raw: unknown): number[] {
  if (typeof raw === 'string') {
    try { const p = JSON.parse(raw); return Array.isArray(p) ? p.map((v) => parseFloat(String(v))) : [] } catch { return [] }
  }
  if (Array.isArray(raw)) return (raw as (string | number)[]).map((v) => parseFloat(String(v)))
  return []
}
function cosine(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0
  let dot = 0, na = 0, nb = 0
  for (let i = 0; i < a.length; i++) { dot += a[i] * (b[i] ?? 0); na += a[i] * a[i]; nb += (b[i] ?? 0) * (b[i] ?? 0) }
  return na && nb ? dot / (Math.sqrt(na) * Math.sqrt(nb)) : 0
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const supabase = createAdminClient()
  const { data } = await supabase.from('user_submissions').select('display_title, display_artist, published').eq('id', id).maybeSingle()
  if (!data || !(data as { published?: boolean }).published) return { title: 'Catalogo — Selecta' }
  const t = data as { display_title: string | null; display_artist: string | null }
  return { title: `${t.display_title ?? 'Traccia'}${t.display_artist ? ' — ' + t.display_artist : ''} · Selecta` }
}

export default async function CatalogTrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: track } = await supabase
    .from('user_submissions')
    .select(`${SELECT}, audio_embedding, published`)
    .eq('id', id)
    .maybeSingle()

  if (!track || !(track as { published?: boolean }).published) notFound()
  const main = track as unknown as CatalogTrack & { audio_embedding: unknown }
  const bucket = bucketByKey(main.sound_bucket)

  // Tracce simili: cosine fra l'embedding di questa traccia e le altre pubblicate.
  const emb = parseEmbedding(main.audio_embedding)
  const { data: others } = await supabase
    .from('user_submissions')
    .select(`${SELECT}, audio_embedding`)
    .eq('published', true)
    .neq('id', id)
    .limit(200)

  const similar: CatalogTrack[] = (others ?? [])
    .map((o) => ({ o: o as unknown as CatalogTrack, sim: cosine(emb, parseEmbedding((o as { audio_embedding: unknown }).audio_embedding)) }))
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 6)
    .map(({ o }) => o)

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <Link href="/catalog" className="mb-6 inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Catalogo
        </Link>

        <div className="grid gap-6 sm:grid-cols-[260px_1fr]">
          <div className="max-w-[260px]">
            <CatalogGrid tracks={[main]} />
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-3xl font-bold text-white">{main.display_title || 'Senza titolo'}</h1>
            <p className="mt-1 text-lg text-zinc-400">{main.display_artist || 'Sconosciuto'}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-sm">
              {bucket && (
                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-emerald-300">
                  {bucket.label}
                </span>
              )}
              {main.genre && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{main.genre}</span>}
              {main.bpm != null && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{Math.round(main.bpm)} BPM</span>}
              {main.key && <span className="rounded-full border border-zinc-800 px-3 py-1 text-zinc-300">{main.key}{main.scale ? ' ' + main.scale : ''}</span>}
            </div>
            {bucket && <p className="mt-4 max-w-md text-sm text-zinc-500">{bucket.blurb}</p>}
          </div>
        </div>

        {similar.length > 0 && (
          <section className="mt-12">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Tracce simili</h2>
            <CatalogGrid tracks={similar} />
          </section>
        )}
      </div>
    </div>
  )
}
