import { createClient } from '@/lib/supabase/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { MapPin, Mail, ExternalLink, Sparkles, Users, MessageSquare, Star } from 'lucide-react'
import { deriveSoundDna } from '@/lib/sound-dna'
import { FollowButton } from '@/components/social/follow-button'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { SimilarArtists } from '@/components/social/similar-artists'
import { EpkShare } from '@/components/social/epk-share'

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
  const NINETY = new Date(Date.now() - 90 * 24 * 3.6e6).toISOString()
  const [{ count: followersCount }, { data: followRow }, { data: trackRows }, { data: allTracks }, { count: newFollowers90 }] = await Promise.all([
    admin.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', p.user_id),
    viewer
      ? admin.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', p.user_id).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('user_submissions')
      .select('id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count')
      .eq('user_id', p.user_id).eq('published', true)
      .order('published_at', { ascending: false }).limit(12),
    admin.from('user_submissions').select('play_count, likes_count, saves_count, published_at').eq('user_id', p.user_id).eq('published', true),
    admin.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', p.user_id).gte('created_at', NINETY),
  ])
  const isSelf = viewer?.id === p.user_id
  const publishedTracks = (trackRows ?? []) as CatalogTrack[]
  const allPub = (allTracks ?? []) as { play_count: number | null; likes_count: number | null; saves_count: number | null; published_at: string | null }[]
  const totals = {
    tracks: allPub.length,
    plays: allPub.reduce((s, t) => s + (t.play_count ?? 0), 0),
    likes: allPub.reduce((s, t) => s + (t.likes_count ?? 0), 0),
    saves: allPub.reduce((s, t) => s + (t.saves_count ?? 0), 0),
    newTracks90: allPub.filter((t) => (t.published_at ?? '') > NINETY).length,
    newFollowers90: newFollowers90 ?? 0,
  }
  const spotlightIds: string[] = (p as unknown as { spotlight?: string[] }).spotlight ?? []
  const spotlightTracks = spotlightIds.map((sid) => publishedTracks.find((t) => t.id === sid)).filter((t): t is CatalogTrack => !!t)
  const restTracks = publishedTracks.filter((t) => !spotlightIds.includes(t.id))

  const initials = (p.display_name || handle).trim().slice(0, 2).toUpperCase()
  const links = Object.entries(p.links ?? {}).filter(([, v]) => v)

  // Testo EPK pronto da incollare nelle email/DM alle label.
  const soundWords = [...(p.sound_descriptors ?? []), ...(dna?.descriptors ?? [])].slice(0, 6)
  const epkText = [
    `${p.display_name || handle}${p.tagline ? ` — ${p.tagline}` : ''}`,
    [(p.genres ?? []).join(' · '), (p.bpm_range || dna?.bpmRange) ? `${p.bpm_range || dna?.bpmRange} BPM` : '', p.city].filter(Boolean).join(' · '),
    soundWords.length ? `Suono: ${soundWords.join(', ')}` : '',
    totals.tracks > 0 ? `${totals.tracks} tracce · ${totals.plays} ascolti · ${followersCount ?? 0} follower` : '',
    p.contact_email ? `Contatto: ${p.contact_email}` : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        {/* Hero */}
        <header className="mb-8 flex flex-col items-center text-center sm:flex-row sm:items-end sm:text-left">
          <div className="mb-4 sm:mb-0 sm:mr-6">
            {p.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.photo_url} alt={p.display_name} className="h-28 w-28 rounded-2xl object-cover sm:h-32 sm:w-32" />
            ) : (
              <div className="flex h-28 w-28 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/30 to-cyan-500/20 text-3xl font-bold text-accent sm:h-32 sm:w-32">
                {initials}
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">{p.display_name || handle}</h1>
            {p.tagline && <p className="mt-1 text-lg text-text">{p.tagline}</p>}
            <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-muted sm:justify-start">
              {(p.genres ?? []).length > 0 && <span className="text-accent">{p.genres.join(' · ')}</span>}
              {(p.bpm_range || dna?.bpmRange) && <span>{p.bpm_range || dna?.bpmRange} BPM</span>}
              {p.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{p.city}</span>}
              <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" />{followersCount ?? 0} follower</span>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 sm:mt-0 sm:self-center">
            <FollowButton targetUserId={p.user_id} initialFollowing={!!followRow} initialFollowers={followersCount ?? 0} isSelf={isSelf} compact />
            {!isSelf && (
              <Link
                href={`/messages/${p.user_id}`}
                className="glass glass-hover inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-text"
              >
                <MessageSquare className="h-4 w-4" /> Messaggio
              </Link>
            )}
            {p.contact_email && (
              <a
                href={`mailto:${p.contact_email}`}
                className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-semibold text-accent-ink shadow-lg transition-transform hover:scale-[1.02]"
              >
                <Mail className="h-4 w-4" /> Contatta
              </a>
            )}
          </div>
        </header>

        {/* Statistiche live */}
        {totals.tracks > 0 && (
          <>
            <section className="glass mb-2 grid grid-cols-4 divide-x divide-line overflow-hidden rounded-2xl">
              {[
                { label: 'Tracce', value: totals.tracks },
                { label: 'Ascolti', value: totals.plays },
                { label: 'Like', value: totals.likes },
                { label: 'Salvataggi', value: totals.saves },
              ].map((s) => (
                <div key={s.label} className="p-3 text-center sm:p-4">
                  <p className="font-display text-xl font-semibold text-text tabular-nums sm:text-2xl">{s.value.toLocaleString('it-IT')}</p>
                  <p className="text-xs text-muted">{s.label}</p>
                </div>
              ))}
            </section>
            {(totals.newTracks90 > 0 || totals.newFollowers90 > 0) && (
              <p className="mb-6 text-center text-xs text-faint sm:text-left">Ultimi 90 giorni: +{totals.newTracks90} {totals.newTracks90 === 1 ? 'traccia' : 'tracce'} · +{totals.newFollowers90} follower</p>
            )}
          </>
        )}

        {/* Condividi come EPK (link + testo pronto per le label) */}
        <div className="mb-6">
          <EpkShare handle={handle} text={epkText} />
        </div>

        {/* Sound DNA — manuale + auto-derivato dalle analisi reali */}
        {((p.sound_descriptors ?? []).length > 0 || (dna && dna.descriptors.length > 0)) && (
          <section className="mb-6 rounded-2xl glass p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
              <Sparkles className="h-3.5 w-3.5 text-accent" /> Il suono
            </p>
            {(p.sound_descriptors ?? []).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {p.sound_descriptors.map((d) => (
                  <span key={d} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm text-accent">
                    {d}
                  </span>
                ))}
              </div>
            )}
            {dna && dna.descriptors.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-xs text-faint">
                  Analizzato da Selecta su {dna.trackCount} {dna.trackCount === 1 ? 'traccia' : 'tracce'}
                </p>
                <div className="flex flex-wrap gap-2">
                  {dna.descriptors.map((d) => (
                    <span key={d} className="rounded-full border border-faint bg-surface-2 px-3 py-1 text-sm text-text">
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* In evidenza (Spotlight) */}
        {spotlightTracks.length > 0 && (
          <section className="mb-6">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-accent"><Star className="h-3.5 w-3.5" /> In evidenza</p>
            <CatalogGrid tracks={spotlightTracks} />
          </section>
        )}

        {/* Tracce pubblicate nel catalogo */}
        {restTracks.length > 0 && (
          <section className="mb-6">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted">{spotlightTracks.length > 0 ? 'Altre tracce' : 'Tracce'}</p>
            <CatalogGrid tracks={restTracks} />
          </section>
        )}

        {/* Producer dal suono simile (peer-graph) */}
        <SimilarArtists userId={p.user_id} />

        {/* Bio */}
        {p.bio && (
          <section className="mb-6 rounded-2xl glass p-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">Bio</p>
            <p className="whitespace-pre-line text-text">{p.bio}</p>
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
                className="flex items-center justify-between rounded-xl glass glass-hover px-4 py-3 text-sm font-medium text-text"
              >
                {LINK_LABELS[k] ?? k}
                <ExternalLink className="h-3.5 w-3.5 text-faint" />
              </a>
            ))}
          </section>
        )}

        {/* Footer contatto + brand */}
        <footer className="mt-10 flex flex-col items-center gap-3 border-t border-line pt-6 text-center">
          {p.contact_email && (
            <a href={`mailto:${p.contact_email}`} className="text-sm text-muted hover:text-text">
              {p.contact_email}
            </a>
          )}
          <span className="text-xs text-faint">Press kit · powered by Selecta</span>
        </footer>
      </div>
    </div>
  )
}
