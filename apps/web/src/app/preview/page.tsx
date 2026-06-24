'use client'

import { useState } from 'react'
import {
  Play, Pause, SkipBack, SkipForward, Download, ArrowRight, Heart,
  Target, Radio, IdCard, Shield, Bell, Check,
} from 'lucide-react'
import { TextReveal } from '@/components/ui/text-reveal'
import { ConstellationStage } from '@/components/marketing/constellation-stage'
import { PremiumNav } from '@/components/marketing/premium-nav'
import { SpotifyLogo, SoundCloudLogo, AppleMusicLogo, YouTubeLogo } from '@/components/ui/brand-logos'

/* ════════════════════════════════════════════════════════════════
   /preview — Homepage "Liquid Glass" (Apple iOS 26 + Mobbin)
   Bianco/Nero con switch · vetro marcato · dettagli colorati sparsi.
   Componenti adattati da 21st.dev: liquid-glass, glass-button, switcher,
   glassmorphism audio block, glass-card, account-settings, text-reveal,
   logos3 (con loghi brand reali). gradient-text reimplementato.
   ════════════════════════════════════════════════════════════════ */

function waveHeights(seed: number, n = 80) {
  return Array.from({ length: n }, (_, i) => {
    const x = i + seed
    const v = Math.abs(Math.sin(x * 0.5) * 0.5 + Math.sin(x * 0.17) * 0.32 + Math.cos(x * 0.09) * 0.22)
    return Math.round(18 + Math.min(1, v) * 82)
  })
}

const TRACKS = [
  { t: 'Nightshift', a: 'Lautaro Vela', key: '8A', bpm: 126, dur: '6:12' },
  { t: 'Pressure Drop', a: 'MONA', key: '5A', bpm: 125, dur: '5:48' },
  { t: 'Concrete', a: 'D. Ferraro', key: '11B', bpm: 124, dur: '7:01' },
  { t: 'Lowlight', a: 'Kira Sound', key: '7A', bpm: 127, dur: '6:34' },
]
const FEATURES = [
  { icon: Target, t: 'Match con le label', b: 'Le etichette che suonano come te, con percentuali oneste.', from: '#0a84ff', to: '#64d2ff' },
  { icon: Radio, t: 'Catalogo curato', b: 'Pubblichi in una library organizzata per come suona.', from: '#34c759', to: '#a8e063' },
  { icon: IdCard, t: 'Press Kit', b: 'Una pagina condivisibile, auto-popolata dal tuo Sound DNA.', from: '#ff9500', to: '#ffcc00' },
]

export default function PreviewPage() {
  const [playing, setPlaying] = useState(true)
  const [current, setCurrent] = useState(0)
  const [autoRenew, setAutoRenew] = useState(true)

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

        {/* ───── BLOCCO AUDIO (glassmorphism listen) ───── */}
        <section className="px-4 py-8">
          <div className="glass-liquid mx-auto max-w-[700px] rounded-[28px] p-6 sm:p-8">
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 shrink-0 items-end justify-center gap-[3px] overflow-hidden rounded-2xl p-4 sm:h-28 sm:w-28" style={{ background: 'linear-gradient(145deg, #fa233b, #bf5af2)' }}>
                {[14, 22, 10, 26, 16].map((h, i) => (
                  <span key={i} className={playing ? 'eq-bar w-1 rounded-full bg-white' : 'w-1 rounded-full bg-white/70'} style={{ height: h, animationDelay: `${i * 0.12}s` }} />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">In riproduzione</p>
                <p className="mt-1 truncate font-display text-2xl font-semibold tracking-tight">{TRACKS[current].t}</p>
                <p className="truncate text-muted">{TRACKS[current].a}</p>
              </div>
              <button className="glass glass-hover hidden h-11 w-11 items-center justify-center rounded-full text-text sm:flex"><Heart className="h-5 w-5" /></button>
            </div>

            <div className="mt-6 flex h-12 items-center gap-[2px]">
              {waveHeights(3, 120).map((h, i) => (
                <span key={i} className="w-px flex-1 rounded-full" style={{ height: `${h}%`, background: i / 120 < 0.42 ? 'var(--color-text)' : 'var(--color-wave)' }} />
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-xs text-faint"><span>2:34</span><span>{TRACKS[current].dur}</span></div>

            <div className="mt-5 flex items-center justify-center gap-4">
              <button onClick={() => setCurrent((c) => (c + TRACKS.length - 1) % TRACKS.length)} className="glass glass-hover flex h-12 w-12 items-center justify-center rounded-full text-text"><SkipBack className="h-5 w-5" /></button>
              <button onClick={() => setPlaying((p) => !p)} className="flex h-16 w-16 items-center justify-center rounded-full bg-text text-bg transition-transform hover:scale-[1.04]">
                {playing ? <Pause className="h-7 w-7" /> : <Play className="h-7 w-7 translate-x-0.5" />}
              </button>
              <button onClick={() => setCurrent((c) => (c + 1) % TRACKS.length)} className="glass glass-hover flex h-12 w-12 items-center justify-center rounded-full text-text"><SkipForward className="h-5 w-5" /></button>
            </div>
          </div>
        </section>

        {/* ───── CATALOGO (glass) ───── */}
        <section className="mx-auto max-w-[900px] px-4 py-12">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="font-display display-tight text-3xl font-semibold tracking-tight sm:text-4xl">Catalogo esclusivo</h2>
            <span className="text-sm font-medium text-muted">Tutte le tracce →</span>
          </div>
          <div className="glass overflow-hidden rounded-[24px] p-2">
            {TRACKS.map((tr, i) => (
              <div key={tr.t} onClick={() => { setCurrent(i); setPlaying(true) }}
                className={`flex cursor-pointer items-center gap-4 rounded-2xl px-4 py-3 transition-colors ${current === i ? 'bg-text/[0.06]' : 'hover:bg-text/[0.04]'}`}>
                <button className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-text">
                  {current === i && playing ? <Pause className="h-[18px] w-[18px]" /> : <Play className="h-[18px] w-[18px] translate-x-px" />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium">{tr.t}</p>
                  <p className="truncate text-sm text-muted">{tr.a}</p>
                </div>
                <span className="hidden font-mono text-sm text-muted sm:block">{tr.key}</span>
                <span className="hidden w-14 font-mono text-sm text-muted sm:block">{tr.bpm} BPM</span>
                <div className="hidden h-7 w-40 items-center gap-[2px] md:flex">
                  {waveHeights(i * 9, 56).map((h, k) => <span key={k} className="w-px flex-1 rounded-full" style={{ height: `${h}%`, background: 'var(--color-wave)' }} />)}
                </div>
                <span className="hidden font-mono text-sm text-faint sm:block">{tr.dur}</span>
                <button className="flex h-9 w-9 items-center justify-center rounded-full text-faint hover:text-text"><Download className="h-[18px] w-[18px]" /></button>
              </div>
            ))}
          </div>
        </section>

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

        {/* ───── ACCOUNT / SETTINGS (glass, adattato) ───── */}
        <section className="mx-auto max-w-[900px] px-4 py-12">
          <div className="glass rounded-[28px] p-8 sm:p-10">
            <div className="mb-8 flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-xs uppercase tracking-[0.22em] text-muted">Il tuo account</p>
                <h2 className="mt-2 font-display text-2xl font-semibold tracking-tight sm:text-3xl">Tutto in un posto solo</h2>
              </div>
              <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ background: 'linear-gradient(145deg, #bf5af2, #0a84ff)' }}>FOUNDING</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center gap-2 text-sm font-medium"><Shield className="h-4 w-4 text-muted" /> Sicurezza</div>
                <div className="mt-4 space-y-4 text-sm">
                  <div><p className="text-faint">Email</p><p className="mt-0.5 font-medium">alex@selecta.app</p></div>
                  <label className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-muted"><Bell className="h-4 w-4" /> Email di aggiornamento</span>
                    <button onClick={() => setAutoRenew((v) => !v)} className={`relative h-6 w-11 rounded-full transition-colors ${autoRenew ? 'bg-text' : 'bg-surface-2'}`}>
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg transition-transform ${autoRenew ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
                    </button>
                  </label>
                </div>
              </div>
              <div className="glass rounded-2xl p-6">
                <div className="flex items-center justify-between">
                  <div><p className="text-sm font-medium">Piano attuale</p><p className="text-xs text-faint">Founding · a vita</p></div>
                  <span className="font-display text-2xl font-semibold">€0</span>
                </div>
                <div className="mt-4 space-y-2.5 text-sm text-muted">
                  {['Match con le label', 'Report PRO incluso', 'Badge a vita'].map((x) => (
                    <p key={x} className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full text-white" style={{ background: 'linear-gradient(145deg,#34c759,#a8e063)' }}><Check className="h-3 w-3" /></span>{x}
                    </p>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ───── CTA ───── */}
        <section className="px-4 py-16">
          <div className="glass-liquid mx-auto max-w-[760px] rounded-[28px] px-8 py-14 text-center sm:py-20">
            <h2 className="mx-auto max-w-[14ch] font-display display-tight text-[2.2rem] font-semibold leading-[1.02] sm:text-[3.5rem]">Il prossimo firmato sei tu.</h2>
            <button className="glass glass-hover group mt-8 inline-flex items-center gap-2 rounded-full px-7 py-4 text-[15px] font-semibold text-text">
              Analizza gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </section>

        <footer className="mx-auto flex max-w-[900px] flex-wrap items-center justify-between gap-3 px-4 py-10 text-sm text-faint">
          <span className="font-display font-semibold text-text">Selecta</span>
          <span>Anteprima · usa lo switch in alto per chiaro/scuro</span>
          <span>© 2026</span>
        </footer>
      </div>
    </div>
  )
}
