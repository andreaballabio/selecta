'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { deriveSoundDna } from '@/lib/sound-dna'
import { AppShell } from '@/components/app/app-shell'
import {
  Loader2, Sparkles, BarChart3, IdCard, Music, LogOut, ArrowRight, ExternalLink,
  Play, Heart, Bookmark, Radio, Users, Settings, Pencil, ListMusic, Plus,
} from 'lucide-react'

interface Submission {
  id: string
  title: string | null
  display_title: string | null
  cover_url: string | null
  created_at: string | null
  analysis_status: string | null
  published: boolean | null
  bpm: number | null
  key: string | null
  scale: string | null
  sub_ratio: number | null
  mid_presence: number | null
  spectral_centroid: number | null
  onset_strength: number | null
  likes_count: number | null
  saves_count: number | null
  play_count: number | null
  match_results: { label_name: string; score: number }[] | null
}

interface Profile {
  handle: string
  display_name: string
  photo_url: string | null
  city: string | null
  tagline: string | null
}

const PENDING_KEY = 'selecta:pending_submissions'
async function claimPendingSubmissions() {
  if (typeof window === 'undefined') return
  let ids: string[] = []
  try { const raw = window.localStorage.getItem(PENDING_KEY); ids = raw ? JSON.parse(raw) : [] } catch { return }
  if (!Array.isArray(ids) || ids.length === 0) return
  try {
    await fetch('/api/match/claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }) })
    window.localStorage.removeItem(PENDING_KEY)
  } catch { /* riproveremo */ }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [savedCount, setSavedCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [playlists, setPlaylists] = useState<{ id: string; title: string; is_public: boolean }[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email ?? '')
      await claimPendingSubmissions()

      const [{ data: prof }, { data: rows }, { count: saved }, { count: following }, { data: pls }] = await Promise.all([
        (supabase as any).from('artist_profiles').select('handle, display_name, photo_url, city, tagline').eq('user_id', user.id).maybeSingle(),
        (supabase as any).from('user_submissions')
          .select('id, title, display_title, cover_url, created_at, analysis_status, published, bpm, key, scale, sub_ratio, mid_presence, spectral_centroid, onset_strength, likes_count, saves_count, play_count, match_results')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(80),
        (supabase as any).from('track_saves').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        (supabase as any).from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', user.id),
        (supabase as any).from('playlists').select('id, title, is_public').eq('user_id', user.id).order('updated_at', { ascending: false }),
      ])
      setProfile(prof ?? null)
      setSubs(rows ?? [])
      setSavedCount(saved ?? 0)
      setFollowingCount(following ?? 0)
      setPlaylists(pls ?? [])
      setLoading(false)
    })()
  }, [router, supabase])

  const logout = async () => { await supabase.auth.signOut(); router.push('/'); router.refresh() }

  const createPlaylist = async () => {
    const t = window.prompt('Titolo della nuova playlist')
    if (!t || !t.trim()) return
    const res = await fetch('/api/playlists', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t.trim() }) })
    const { playlist } = await res.json()
    if (playlist) router.push(`/playlist/${playlist.id}`)
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
  }

  const analyzed = subs.filter(s => s.analysis_status === 'analyzed')
  const published = subs.filter(s => s.published)
  const dna = deriveSoundDna(analyzed)
  const firstName = (profile?.display_name || email.split('@')[0] || 'artista').split(' ')[0]
  const initials = (profile?.display_name || firstName).trim().slice(0, 2).toUpperCase()
  const totalPlays = published.reduce((s, t) => s + (t.play_count ?? 0), 0)
  const totalLikes = published.reduce((s, t) => s + (t.likes_count ?? 0), 0)
  const totalSaves = published.reduce((s, t) => s + (t.saves_count ?? 0), 0)

  const STATS = [
    { label: 'Analisi', value: analyzed.length },
    { label: 'Pubblicate', value: published.length },
    { label: 'Ascolti', value: totalPlays },
    { label: 'Like', value: totalLikes },
    { label: 'Salvataggi', value: totalSaves },
    { label: 'Segui', value: followingCount },
  ]

  return (
    <AppShell>
        {/* ── Header profilo ── */}
        <div className="mb-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-surface-2 ring-1 ring-line">
              {profile?.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={profile.photo_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center font-display text-xl font-bold text-faint">{initials}</div>
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold tracking-tight text-text">Ciao, {firstName}</h1>
              <p className="mt-0.5 text-sm text-muted">
                {profile?.handle ? <Link href={`/u/${profile.handle}`} className="hover:text-accent">@{profile.handle}</Link> : email}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/profile" className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm font-medium text-text hover:border-faint">
              <Pencil className="h-4 w-4" /> Profilo
            </Link>
            <button onClick={logout} className="flex items-center gap-1.5 rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-text">
              <LogOut className="h-4 w-4" /> Esci
            </button>
          </div>
        </div>

        {/* ── Statistiche ── */}
        <div className="mb-8 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-6">
          {STATS.map((s) => (
            <div key={s.label} className="bg-surface/60 p-4 text-center">
              <p className="font-display text-2xl font-bold text-text tabular-nums">{s.value}</p>
              <p className="mt-0.5 text-xs text-muted">{s.label}</p>
            </div>
          ))}
        </div>

        {/* ── Sound DNA ── */}
        {dna && dna.descriptors.length > 0 && (
          <div className="mb-8 rounded-2xl border border-accent/20 bg-accent/[0.04] p-5">
            <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Il tuo Sound DNA
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {dna.descriptors.map(d => (
                <span key={d} className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-sm text-accent">{d}</span>
              ))}
              {dna.bpmRange && <span className="text-sm text-muted">· {dna.bpmRange} BPM</span>}
              <span className="text-sm text-faint">· da {dna.trackCount} {dna.trackCount === 1 ? 'analisi' : 'analisi'}</span>
            </div>
          </div>
        )}

        {/* ── Azioni rapide ── */}
        <div className="mb-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { href: '/match', icon: BarChart3, title: 'Analizza', sub: 'Match + Report PRO' },
            { href: profile ? `/u/${profile.handle}` : '/profile', icon: IdCard, title: profile ? 'La tua Press Kit' : 'Crea Press Kit', sub: profile ? `/u/${profile.handle}` : 'Pagina condivisibile' },
            { href: '/saved', icon: Bookmark, title: 'Salvati', sub: `${savedCount} tracce in crate` },
            { href: '/library', icon: Radio, title: 'Library', sub: 'Esplora il catalogo' },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="group rounded-2xl border border-line bg-surface/50 p-5 transition-colors hover:border-faint hover:bg-surface-2/60">
              <a.icon className="mb-3 h-6 w-6 text-accent" />
              <p className="font-semibold text-text">{a.title}</p>
              <p className="mt-0.5 truncate text-sm text-muted">{a.sub}</p>
            </Link>
          ))}
        </div>

        {/* ── Le tue playlist ── */}
        <div className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted"><ListMusic className="h-4 w-4" /> Le tue playlist</h2>
            <button onClick={createPlaylist} className="flex items-center gap-1.5 text-sm text-accent hover:underline"><Plus className="h-4 w-4" /> Nuova</button>
          </div>
          {playlists.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line bg-surface/40 p-6 text-sm text-muted">Nessuna playlist. Creane una e aggiungi tracce dal catalogo.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {playlists.map((pl) => (
                <Link key={pl.id} href={`/playlist/${pl.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface/50 p-4 transition-colors hover:border-faint">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-accent"><ListMusic className="h-5 w-5" /></div>
                  <div className="min-w-0"><p className="truncate font-medium text-text">{pl.title}</p><p className="text-xs text-muted">{pl.is_public ? 'Pubblica' : 'Privata'}</p></div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Le mie tracce ── */}
        <div className="mb-10">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Music className="h-4 w-4" /> Le mie tracce
          </h2>
          {subs.length === 0 ? (
            <Link href="/match" className="flex items-center justify-between rounded-2xl border border-dashed border-line bg-surface/40 p-6 transition-colors hover:border-faint">
              <span className="flex items-center gap-3 text-muted"><Music className="h-5 w-5 text-faint" /> Nessuna analisi ancora. Carica la tua prima traccia.</span>
              <ArrowRight className="h-4 w-4 text-faint" />
            </Link>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => {
                const top = s.match_results?.[0]
                const title = s.display_title || s.title || 'Senza titolo'
                return (
                  <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-line bg-surface/50 p-4">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                      {s.cover_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.cover_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center font-display text-sm font-bold text-faint">{title.slice(0, 2).toUpperCase()}</div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {s.published ? (
                          <Link href={`/catalog/${s.id}`} className="truncate font-medium text-text hover:text-accent">{title}</Link>
                        ) : (
                          <span className="truncate font-medium text-text">{title}</span>
                        )}
                        {s.published
                          ? <span className="shrink-0 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">Live</span>
                          : <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-faint">Bozza</span>}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT') : ''}
                        {s.bpm ? ` · ${Math.round(s.bpm)} BPM` : ''}
                        {s.key ? ` · ${s.key}${s.scale ? ' ' + s.scale : ''}` : ''}
                        {s.published ? '' : top ? ` · top match ${Math.min(100, Math.round(top.score * 100))}% ${top.label_name}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {s.analysis_status === 'analyzed' ? (
                        s.published ? (
                          <div className="flex items-center gap-3 text-xs text-muted">
                            <span className="flex items-center gap-1"><Play className="h-3.5 w-3.5" />{s.play_count ?? 0}</span>
                            <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{s.likes_count ?? 0}</span>
                            <span className="flex items-center gap-1"><Bookmark className="h-3.5 w-3.5" />{s.saves_count ?? 0}</span>
                          </div>
                        ) : top ? (
                          <span className="text-sm font-semibold text-accent">{Math.min(100, Math.round(top.score * 100))}%</span>
                        ) : null
                      ) : s.analysis_status === 'failed' ? (
                        <span className="text-xs text-red-400">errore</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-muted"><Loader2 className="h-3 w-3 animate-spin" /> in corso</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* ── Impostazioni ── */}
        <div>
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
            <Settings className="h-4 w-4" /> Impostazioni
          </h2>
          <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface/50">
            <Row label="Email" value={email} />
            <Row label="Press Kit" value={profile?.handle ? `selecta-eta.vercel.app/u/${profile.handle}` : 'Non ancora creata'}
              action={profile?.handle
                ? <Link href={`/u/${profile.handle}`} target="_blank" className="flex items-center gap-1 text-sm text-accent hover:underline">Apri <ExternalLink className="h-3.5 w-3.5" /></Link>
                : <Link href="/profile" className="text-sm text-accent hover:underline">Crea</Link>} />
            <Row label="Community" value={`Segui ${followingCount} ${followingCount === 1 ? 'artista' : 'artisti'}`}
              action={<Link href="/artists" className="flex items-center gap-1 text-sm text-muted hover:text-text"><Users className="h-4 w-4" /> Artisti</Link>} />
            <Row label="Preferenze" value="Notifiche e genere preferito" badge="presto" />
          </div>
        </div>
      </AppShell>
  )
}

function Row({ label, value, action, badge }: { label: string; value: string; action?: React.ReactNode; badge?: string }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-text">{label} {badge && <span className="ml-1 rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wider text-faint">{badge}</span>}</p>
        <p className="mt-0.5 truncate text-sm text-muted">{value}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
