'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  Play, Pause, SkipBack, SkipForward, Download, ArrowRight, Heart,
  Target, Radio, IdCard,
} from 'lucide-react'
import { TextReveal } from '@/components/ui/text-reveal'
import { ConstellationStage } from '@/components/marketing/constellation-stage'
import { PremiumNav } from '@/components/marketing/premium-nav'
import { SpotifyLogo, SoundCloudLogo, AppleMusicLogo, YouTubeLogo } from '@/components/ui/brand-logos'
import { usePlayer } from '@/components/player/player-context'
import { toPlayerTrack, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { StatCounter } from '@/components/marketing/stat-counter'

/* ════════════════════════════════════════════════════════════════
   Homepage "Liquid Glass" (Apple iOS 26 + Mobbin) — hero Costellazione.
   Bianco/Nero con switch · vetro marcato · dettagli colorati sparsi.
   Le sezioni blocco-audio e catalogo usano i BRANI REALI passati come
   prop e il player globale (clic = ascolto vero, conteggi reali).
   Senza prop usa un piccolo set d'esempio (per /preview offline).
   ════════════════════════════════════════════════════════════════ */

const fmt = (s: number) => {
  if (!s || !isFinite(s)) return '0:00'
  const m = Math.floor(s / 60), sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function waveHeights(seed: number, n = 80) {
  return Array.from({ length: n }, (_, i) => {
    const x = i + seed
    const v = Math.abs(Math.sin(x * 0.5) * 0.5 + Math.sin(x * 0.17) * 0.32 + Math.cos(x * 0.09) * 0.22)
    return Math.round(18 + Math.min(1, v) * 82)
  })
}

const SAMPLE: CatalogTrack[] = [
  { id: 's1', display_title: 'Nightshift', display_artist: 'Lautaro Vela', cover_url: null, file_url: null, bpm: 126, key: '8A', scale: null, genre: 'Tech House', sound_bucket: null, likes_count: 0 },
  { id: 's2', display_title: 'Pressure Drop', display_artist: 'MONA', cover_url: null, file_url: null, bpm: 125, key: '5A', scale: null, genre: 'Tech House', sound_bucket: null, likes_count: 0 },
  { id: 's3', display_title: 'Concrete', display_artist: 'D. Ferraro', cover_url: null, file_url: null, bpm: 124, key: '11B', scale: null, genre: 'Tech House', sound_bucket: null, likes_count: 0 },
  { id: 's4', display_title: 'Lowlight', display_artist: 'Kira Sound', cover_url: null, file_url: null, bpm: 127, key: '7A', scale: null, genre: 'Tech House', sound_bucket: null, likes_count: 0 },
]

const FEATURES = [
  { icon: Target, t: 'Match con le label', b: 'Le etichette che suonano come te, con percentuali oneste.', from: '#0a84ff', to: '#64d2ff' },
  { icon: Radio, t: 'Catalogo curato', b: 'Pubblichi in una library organizzata per come suona.', from: '#34c759', to: '#a8e063' },
  { icon: IdCard, t: 'Press Kit', b: 'Una pagina condivisibile, auto-popolata dal tuo Sound DNA.', from: '#ff9500', to: '#ffcc00' },
]

const STEPS = [
  { t: 'Carica la tua traccia', b: 'L’AI legge la tua firma timbrica — il Sound DNA — in pochi secondi.' },
  { t: 'Scopri le label affini', b: 'Le etichette che suonano come te, con percentuali oneste e il perché.' },
  { t: 'Pubblica e fatti trovare', b: 'Entri nel catalogo curato per suono, dove DJ e A&R cercano nuova musica.' },
]

export type HomeStats = { analyzed: number; published: number; artists: number }
const DEFAULT_STATS: HomeStats = { analyzed: 1240, published: 320, artists: 180 } // solo per /preview offline

export function HomeRedesign({ tracks, stats }: { tracks?: CatalogTrack[]; stats?: HomeStats }) {
  const data = tracks && tracks.length ? tracks : SAMPLE
  const ptracks = useMemo(() => data.map(toPlayerTrack), [data])
  const player = usePlayer()
  const st = stats ?? DEFAULT_STATS

  const liveIdx = data.findIndex((t) => t.id === player.current?.id)
  const feat = liveIdx >= 0 ? data[liveIdx] : data[0]
  const live = liveIdx >= 0
  const playing = live && player.playing

  const start = (i: number) => player.playQueue(ptracks, i)
  const onPlayPause = () => { if (live) player.togglePlay(); else start(Math.max(0, liveIdx)) }

  const curT = live ? player.duration * player.progress : 0
  const durT = live ? player.duration : 0

  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      {/* orbi ambientali */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0">
        <div className="absolute -left-40 top-[-10rem] h-[42rem] w-[42rem] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, var(--orb-1), transparent 70%)' }} />
        <div className="absolute right-[-12rem] top-[24rem] h-[40rem] w-[40rem] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, var(--orb-2), transparent 70%)' }} />
        <div className="absolute bottom-[-12rem] left-1/3 h-[36rem] w-[36rem] rounded-full blur-[120px]" style={{ background: 'radial-gradient(circle, var(--orb-1), transparent 70%)' }} />
      </div>

      <div className="relative z-10">
        {/* ───── NAV premium ───── */}
        <PremiumNav />

        {/* ───── HERO: costellazione interattiva (canvas) ───── */}
        <ConstellationStage />

        {/* ───── partner (sotto la fold) ───── */}
        <section className="px-4 pb-4 pt-12 text-center">
          <p className="text-sm text-faint">Pensata per l’ecosistema in cui pubblichi</p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 opacity-90">
            <SpotifyLogo /> <AppleMusicLogo /> <SoundCloudLogo /> <YouTubeLogo />
            <span className="text-lg font-semibold tracking-tight text-faint">Beatport</span>
            <span className="text-lg font-semibold tracking-tight text-faint">Bandcamp</span>
          </div>
        </section>

        {/* ───── TEXT REVEAL (manifesto) ───── */}
        <TextReveal
          className="px-4"
          text="Il tuo modo di suonare è un’impronta. Selecta la legge, e ti dice esattamente dove può essere firmata."
        />

        {/* ───── COME FUNZIONA (3 passi) ───── */}
        <section className="mx-auto max-w-[900px] px-4 py-12">
          <div className="mb-10 text-center">
            <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Come funziona</p>
            <h2 className="mt-2 font-display display-tight text-3xl font-semibold tracking-tight sm:text-4xl">Dal tuo suono al contratto, in tre passi</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {STEPS.map((s, i) => (
              <div key={s.t} className="glass rounded-[22px] p-6">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-text font-display text-sm font-bold text-bg">{i + 1}</span>
                <h3 className="mt-4 font-display text-lg font-semibold tracking-tight">{s.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── BLOCCO AUDIO (glassmorphism listen) — brano in evidenza reale ───── */}
        {feat && (
          <section className="px-4 py-8">
            <div className="glass-liquid mx-auto max-w-[700px] rounded-[28px] p-6 sm:p-8">
              <div className="flex items-center gap-5">
                <div className="flex h-24 w-24 shrink-0 items-end justify-center gap-[3px] overflow-hidden rounded-2xl p-4 sm:h-28 sm:w-28" style={{ background: 'linear-gradient(145deg, #fa233b, #bf5af2)' }}>
                  {[14, 22, 10, 26, 16].map((h, i) => (
                    <span key={i} className={playing ? 'eq-bar w-1 rounded-full bg-white' : 'w-1 rounded-full bg-white/70'} style={{ height: h, animationDelay: `${i * 0.12}s` }} />
                  ))}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">{live ? 'In riproduzione' : 'In evidenza'}</p>
                  <p className="mt-1 truncate font-display text-2xl font-semibold tracking-tight">{feat.display_title ?? 'Senza titolo'}</p>
                  <p className="truncate text-muted">{feat.display_artist ?? '—'}</p>
                </div>
                <button className="glass glass-hover hidden h-11 w-11 items-center justify-center rounded-full text-text sm:flex"><Heart className="h-5 w-5" /></button>
              </div>

              <div className="mt-6 flex h-12 items-center gap-[2px]">
                {waveHeights(3, 120).map((h, i) => (
                  <span key={i} className="w-px flex-1 rounded-full" style={{ height: `${h}%`, background: live && i / 120 < player.progress ? 'var(--color-text)' : 'var(--color-wave)' }} />
                ))}
              </div>
              <div className="mt-2 flex items-center justify-between font-mono text-xs text-faint"><span>{fmt(curT)}</span><span>{durT ? fmt(durT) : '—'}</span></div>

              <div className="mt-5 flex items-center justify-center gap-4">
                <button onClick={() => player.prev()} className="glass glass-hover flex h-12 w-12 items-center justify-center rounded-full text-text"><SkipBack className="h-5 w-5" /></button>
                <button onClick={onPlayPause} className="flex h-16 w-16 items-center justify-center rounded-full bg-text text-bg transition-transform hover:scale-[1.04]">
                  {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 translate-x-0.5" />}
                </button>
                <button onClick={() => player.next()} className="glass glass-hover flex h-12 w-12 items-center justify-center rounded-full text-text"><SkipForward className="h-5 w-5" /></button>
              </div>
            </div>
          </section>
        )}

        {/* ───── CATALOGO (glass) — tracce reali ───── */}
        {data.length > 0 && (
          <section className="mx-auto max-w-[900px] px-4 py-12">
            <div className="mb-6 flex items-end justify-between">
              <h2 className="font-display display-tight text-3xl font-semibold tracking-tight sm:text-4xl">Cosa sta girando</h2>
              <Link href="/charts" className="text-sm font-medium text-muted hover:text-text">Tutte le classifiche →</Link>
            </div>
            <div className="glass overflow-hidden rounded-[24px] p-2">
              {data.map((tr, i) => {
                const isCur = tr.id === player.current?.id
                return (
                  <div key={tr.id} onClick={() => start(i)}
                    className={`flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-colors ${isCur ? 'bg-text/[0.06]' : 'hover:bg-text/[0.04]'}`}>
                    <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text">
                      {isCur && player.playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="h-[18px] w-[18px] translate-x-px" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{tr.display_title ?? 'Senza titolo'}</p>
                      <p className="truncate text-sm text-muted">{tr.display_artist ?? '—'}</p>
                    </div>
                    {tr.key && <span className="hidden font-mono text-sm text-muted sm:block">{tr.key}</span>}
                    {tr.bpm ? <span className="hidden w-14 font-mono text-sm text-muted sm:block">{tr.bpm} BPM</span> : null}
                    <div className="hidden h-7 w-40 items-center gap-[2px] md:flex">
                      {waveHeights(i * 9, 56).map((h, k) => <span key={k} className="w-px flex-1 rounded-full" style={{ height: `${h}%`, background: 'var(--color-wave)' }} />)}
                    </div>
                    {tr.file_url && (
                      <a href={tr.file_url} download onClick={(e) => e.stopPropagation()} className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:text-text"><Download className="h-[18px] w-[18px]" /></a>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ───── FEATURE (glass cards, icone colorate) ───── */}
        <section className="mx-auto max-w-[900px] px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-3">
            {FEATURES.map((f) => (
              <div key={f.t} className="glass glass-hover rounded-[22px] p-6">
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: `linear-gradient(145deg, ${f.from}, ${f.to})` }}>
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-display text-lg font-semibold tracking-tight">{f.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">{f.b}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── NUMERI REALI ───── */}
        <section className="mx-auto max-w-[900px] px-4 py-12">
          <div className="glass grid grid-cols-3 gap-4 rounded-[28px] px-6 py-8 text-center sm:py-10">
            {([[st.analyzed, 'Tracce analizzate'], [st.published, 'Nel catalogo'], [st.artists, 'Artisti']] as [number, string][]).map(([v, l]) => (
              <div key={l}>
                <p className="font-display text-3xl font-semibold tracking-tight sm:text-5xl"><StatCounter value={v} /></p>
                <p className="mt-1.5 text-xs text-muted sm:text-sm">{l}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ───── CTA ───── */}
        <section className="px-4 py-16">
          <div className="glass-liquid mx-auto max-w-[760px] rounded-[28px] px-8 py-14 text-center sm:py-20">
            <h2 className="mx-auto max-w-[14ch] font-display display-tight text-[2.2rem] font-semibold leading-[1.02] sm:text-[3.5rem]">Il prossimo firmato sei tu.</h2>
            <Link href="/match" className="glass glass-hover group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-text">
              Analizza gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-10 text-sm text-faint">
          <span className="font-display font-semibold text-text">Selecta</span>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1">
            <Link href="/match" className="hover:text-text">Analizza</Link>
            <Link href="/library" className="hover:text-text">Library</Link>
            <Link href="/charts" className="hover:text-text">Classifiche</Link>
            <Link href="/pricing" className="hover:text-text">Prezzi</Link>
            <Link href="/terms" className="hover:text-text">Termini</Link>
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
          </nav>
          <span>© 2026 Selecta</span>
        </footer>
      </div>
    </div>
  )
}
