'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { deriveSoundDna } from '@/lib/sound-dna'
import {
  Loader2, Sparkles, BarChart3, IdCard, Music, LogOut, ArrowRight, ExternalLink,
} from 'lucide-react'

interface Submission {
  id: string
  title: string | null
  created_at: string | null
  analysis_status: string | null
  bpm: number | null
  key: string | null
  scale: string | null
  sub_ratio: number | null
  mid_presence: number | null
  spectral_centroid: number | null
  onset_strength: number | null
  match_results: { label_name: string; score: number }[] | null
}

interface Profile {
  handle: string
  display_name: string
}

/**
 * Reclama le analisi fatte da anonimo (id salvati nel localStorage dalla pagina
 * /match) collegandole all'utente appena loggato. Best-effort: in caso di errore
 * la dashboard prosegue comunque.
 */
const PENDING_KEY = 'selecta:pending_submissions'
async function claimPendingSubmissions() {
  if (typeof window === 'undefined') return
  let ids: string[] = []
  try {
    const raw = window.localStorage.getItem(PENDING_KEY)
    ids = raw ? JSON.parse(raw) : []
  } catch { return }
  if (!Array.isArray(ids) || ids.length === 0) return
  try {
    await fetch('/api/match/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    window.localStorage.removeItem(PENDING_KEY)
  } catch { /* riproveremo al prossimo caricamento */ }
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])

  useEffect(() => {
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }
      setEmail(user.email ?? '')

      // Collega all'account le analisi fatte da anonimo in questo browser.
      await claimPendingSubmissions()

      const [{ data: prof }, { data: rows }] = await Promise.all([
        (supabase as any).from('artist_profiles').select('handle, display_name').eq('user_id', user.id).maybeSingle(),
        (supabase as any).from('user_submissions')
          .select('id, title, created_at, analysis_status, bpm, key, scale, sub_ratio, mid_presence, spectral_centroid, onset_strength, match_results')
          .eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ])
      setProfile(prof ?? null)
      setSubs(rows ?? [])
      setLoading(false)
    })()
  }, [router, supabase])

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    )
  }

  const analyzed = subs.filter(s => s.analysis_status === 'analyzed')
  const dna = deriveSoundDna(analyzed)
  const firstName = (profile?.display_name || email.split('@')[0] || 'artista').split(' ')[0]

  return (
    <div className="min-h-screen bg-black">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Ciao, {firstName} 👋</h1>
            <p className="mt-1 text-sm text-zinc-500">{email}</p>
          </div>
          <button onClick={logout} className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-400 hover:text-white">
            <LogOut className="h-4 w-4" /> Esci
          </button>
        </div>

        {/* Sound DNA riassunto */}
        {dna && dna.descriptors.length > 0 && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-950/10 p-5">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-500/80">
              <Sparkles className="h-3.5 w-3.5" /> Il tuo Sound DNA
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {dna.descriptors.map(d => (
                <span key={d} className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">{d}</span>
              ))}
              {dna.bpmRange && <span className="text-sm text-zinc-500">· {dna.bpmRange} BPM</span>}
              <span className="text-sm text-zinc-600">· da {dna.trackCount} {dna.trackCount === 1 ? 'analisi' : 'analisi'}</span>
            </div>
          </div>
        )}

        {/* Azioni rapide */}
        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <Link href="/match" className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 transition-colors hover:border-emerald-500/40">
            <BarChart3 className="mb-3 h-6 w-6 text-emerald-400" />
            <p className="font-semibold text-white">Analizza una traccia</p>
            <p className="mt-0.5 text-sm text-zinc-500">Match con le label + Report PRO</p>
          </Link>
          <Link href={profile ? `/u/${profile.handle}` : '/profile'} className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 transition-colors hover:border-emerald-500/40">
            <IdCard className="mb-3 h-6 w-6 text-emerald-400" />
            <p className="font-semibold text-white">{profile ? 'La tua Press Kit' : 'Crea la Press Kit'}</p>
            <p className="mt-0.5 text-sm text-zinc-500">{profile ? `/u/${profile.handle}` : 'La tua pagina condivisibile'}</p>
          </Link>
          <Link href="/profile" className="group rounded-2xl border border-zinc-800 bg-zinc-950/60 p-5 transition-colors hover:border-emerald-500/40">
            <Sparkles className="mb-3 h-6 w-6 text-emerald-400" />
            <p className="font-semibold text-white">Modifica profilo</p>
            <p className="mt-0.5 text-sm text-zinc-500">Bio, link, foto, contatti</p>
          </Link>
        </div>

        {/* Link rapidi al lato social */}
        <div className="mb-8 flex flex-wrap gap-2 text-sm">
          {[
            { href: '/catalog', label: 'Catalogo' },
            { href: '/charts', label: 'Classifiche' },
            { href: '/artists', label: 'Artisti' },
            { href: '/saved', label: 'I miei salvati' },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full border border-zinc-800 px-3.5 py-1.5 text-zinc-300 transition-colors hover:border-emerald-500/40 hover:text-white">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Le tue analisi */}
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500">Le tue analisi</h2>
          {subs.length === 0 ? (
            <Link href="/match" className="flex items-center justify-between rounded-xl border border-dashed border-zinc-800 bg-zinc-950/40 p-6 text-center transition-colors hover:border-zinc-700">
              <span className="flex items-center gap-3 text-zinc-400"><Music className="h-5 w-5 text-zinc-600" /> Nessuna analisi ancora. Carica la tua prima traccia.</span>
              <ArrowRight className="h-4 w-4 text-zinc-600" />
            </Link>
          ) : (
            <div className="space-y-2">
              {subs.map((s) => {
                const top = s.match_results?.[0]
                return (
                  <div key={s.id} className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-white">{s.title || 'Senza titolo'}</p>
                      <p className="text-xs text-zinc-500">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString('it-IT') : ''}
                        {s.bpm ? ` · ${Math.round(s.bpm)} BPM` : ''}
                        {s.key ? ` · ${s.key}${s.scale ? ' ' + s.scale : ''}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {s.analysis_status === 'analyzed' && top ? (
                        <>
                          <p className="text-sm font-semibold text-emerald-400">{Math.min(100, Math.round(top.score * 100))}%</p>
                          <p className="max-w-[160px] truncate text-xs text-zinc-500">{top.label_name}</p>
                        </>
                      ) : s.analysis_status === 'failed' ? (
                        <span className="text-xs text-red-400">errore</span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-zinc-500"><Loader2 className="h-3 w-3 animate-spin" /> in corso</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {profile && (
          <Link href={`/u/${profile.handle}`} target="_blank" className="mt-6 flex items-center justify-center gap-1.5 text-sm text-zinc-500 hover:text-white">
            Vedi la tua press kit pubblica <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}
