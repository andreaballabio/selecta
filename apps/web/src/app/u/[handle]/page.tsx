import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { MapPin, Mail, ExternalLink, Sparkles, Users } from 'lucide-react'
import { deriveSoundDna } from '@/lib/sound-dna'
import { FollowButton } from '@/components/social/follow-button'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'

interface ArtistProfile {
  user_id: string
  handle: string
  display_name: string
  tagline: string
  city: string
  genres: string[]
  bpm_range: string
  photo_url: string
  bio: string
  links: Record<string, string>
  contact_email: string
  sound_descriptors: string[]
}

async function getProfile(handle: string): Promise<ArtistProfile | null> {
  const supabase = await createClient()
  const { data } = await (supabase as any)
    .from('artist_profiles')
    .select('*')
    .eq('handle', handle.toLowerCase())
    .maybeSingle()
  return (data as ArtistProfile) ?? null
}

export async function generateMetadata({ params }: { params: Promise<{ handle: string }> }): Promise<Metadata> {
  const { handle } = await params
  const p = await getProfile(handle)
  if (!p) return { title: 'Press Kit — Selecta' }
  const title = `${p.display_name || handle} — Press Kit`
  const desc = p.tagline || p.bio?.slice(0, 140) || `${(p.genres ?? []).join(' · ')}`
  return {
    title,
    description: desc,
    openGraph: { title, description: desc, images: p.photo_url ? [p.photo_url] : [] },
  }
}

const LINK_LABELS: Record<string, string> = {
  spotify: 'Spotify',
  soundcloud: 'SoundCloud',
  beatport: 'Beatport',
  instagram: 'Instagram',
  youtube: 'YouTube',
  bandcamp: 'Bandcamp',
}

export default async function ArtistPressKit({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params
  const p = await getProfile(handle)
  if (!p) notFound()

  // Sound DNA auto-derivato dalle analisi dell'utente. La press kit è PUBBLICA,
  // ma user_submissions è protetta da RLS (lettura solo al proprietario), quindi
  // leggiamo l'aggregato — non sensibile — con la service role lato server.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )
  const { data: subs } = await admin
    .from('user_submissions')
    .select('bpm, sub_ratio, mid_presence, spectral_centroid, onset_strength')
    .eq('user_id', p.user_id)
    .eq('analysis_status', 'analyzed')
    .limit(50)
  const dna = deriveSoundDna(subs as Parameters<typeof deriveSoundDna>[0])

  // Follow: numero follower + se il visitatore (loggato) segue già questo artista.
  const ssr = await createClient()
  const { data: { user: viewer } } = await ssr.auth.getUser()
  const [{ count: followersCount }, { data: followRow }, { data: trackRows }] = await Promise.all([
    admin.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', p.user_id),
    viewer
      ? admin.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', p.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('user_submissions')
      .select('id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count')
      .eq('user_id', p.user_id).eq('published', true)
      .order('published_at', { ascending: false }).limit(12),
  ])
  const isSelf = viewer?.id === p.user_id
  const publishedTracks = (trackRows ?? []) as CatalogTrack[]

  const initials = (p.display_name || handle).trim().slice(0, 2).toUpperCase()
  const links = Object.entries(p.links ?? {}).filter(([, v]) => v)

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Hero */}
        <header className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
          <div className="mb-4 sm:mb-0 sm:mr-6">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt={p.display_name} className="h-28 w-28 rounded-2xl object-cover sm:h-32 sm:w-32" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 text-3xl font-bold text-emerald-300 sm:h-32 sm:w-32">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">{p.display_name || handle}</h1>
            {p.tagline && <p className="mt-1 text-lg text-zinc-300">{p.tagline}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-zinc-500 sm:justify-start">
              {(p.genres ?? []).length > 0 && <span className="text-emerald-400">{p.genres.join(' · ')}</span>}
              {(p.bpm_range || dna?.bpmRange) && <span>{p.bpm_range || dna?.bpmRange} BPM</span>}
              {p.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}</span>}
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{followersCount ?? 0} follower</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 sm:mt-0 sm:self-center">
            <FollowButton targetUserId={p.user_id} initialFollowing={!!followRow} initialFollowers={followersCount ?? 0} isSelf={isSelf} compact />
            {p.contact_email && (
              <a
                href={`mailto:${p.contact_email}`}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-emerald-400"
              >
                <Mail className="h-4 w-4" /> Contatta
              </a>
            )}
          </div>
        </header>

        {/* Sound DNA — manuale + auto-derivato dalle analisi reali */}
        {((p.sound_descriptors ?? []).length > 0 || (dna && dna.descriptors.length > 0)) && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Il suono
            </p>
            {(p.sound_descriptors ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.sound_descriptors.map((d) => (
                  <span key={d} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                    {d}
                  </span>
                ))}
              </div>
            )}
            {dna && dna.descriptors.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs text-zinc-600">
                  Analizzato da Selecta su {dna.trackCount} {dna.trackCount === 1 ? 'traccia' : 'tracce'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dna.descriptors.map((d) => (
                    <span key={d} className="rounded-full border border-zinc-700 bg-zinc-900 px-3 py-1 text-sm text-zinc-300">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Tracce pubblicate nel catalogo */}
        {publishedTracks.length > 0 && (
          <section className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">Tracce</p>
            <CatalogGrid tracks={publishedTracks} />
          </section>
        )}

        {/* Bio */}
        {p.bio && (
          <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Bio</p>
            <p className="whitespace-pre-line text-zinc-300">{p.bio}</p>
          </section>
        )}

        {/* Links */}
        {links.length > 0 && (
          <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {links.map(([k, url]) => (
              <a
                key={k}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 px-4 py-3 text-sm font-medium text-zinc-300 transition-colors hover:border-zinc-700 hover:text-white"
              >
                {LINK_LABELS[k] ?? k}
                <ExternalLink className="h-3.5 w-3.5 text-zinc-600" />
              </a>
            ))}
          </section>
        )}

        {/* Footer contatto + brand */}
        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-zinc-900 pt-6 text-center">
          {p.contact_email && (
            <a href={`mailto:${p.contact_email}`} className="text-sm text-zinc-400 hover:text-white">
              {p.contact_email}
            </a>
          )}
          <span className="text-xs text-zinc-700">Press kit · powered by Selecta</span>
        </footer>
      </div>
    </div>
  )
}
