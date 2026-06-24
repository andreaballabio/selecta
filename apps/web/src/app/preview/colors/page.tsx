'use client'

import { Upload } from 'lucide-react'

/* Confronto direzioni colore — versione "super premium" legata al progetto
   (tech house / underground / after-hours / AI). Base nera calda, UNA firma forte
   trattata come luce o metallo. Sfondo fisso scuro per valutare. */

type Opt = { n: string; sub: string; ring: string; halo: string; glow: string }

const OPTIONS: Opt[] = [
  {
    n: '1 · Cromo / titanio',
    sub: 'metallo lucido, zero colore — futurista, AI, senza tempo',
    ring: 'conic-gradient(from 0deg, #f4f4f7, #8d8d95, #ffffff, #5c5c64, #d8d8de, #9a9aa2, #f4f4f7)',
    halo: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent 70%)',
    glow: 'rgba(255,255,255,0.25)',
  },
  {
    n: '2 · Ember / after-hours',
    sub: 'ambra incandescente, luce da club alle 4 — caldo, notturno',
    ring: 'conic-gradient(from 0deg, #3a1600, #ff8a1e, #ffd27a, #ff7a18, #3a1600)',
    halo: 'radial-gradient(circle, rgba(255,138,30,0.55), transparent 70%)',
    glow: 'rgba(255,138,30,0.45)',
  },
  {
    n: '3 · Ultravioletto',
    sub: 'luce blacklight da rave, ma raffinata — elettronico, profondo',
    ring: 'conic-gradient(from 0deg, #21075c, #8a3cff, #cdaaff, #7a2bff, #21075c)',
    halo: 'radial-gradient(circle, rgba(138,60,255,0.5), transparent 70%)',
    glow: 'rgba(138,60,255,0.45)',
  },
  {
    n: '4 · Oxblood / noir',
    sub: 'rosso vino profondo — sensuale, esclusivo, vinile',
    ring: 'conic-gradient(from 0deg, #2a0610, #c0304a, #ff7088, #b32741, #2a0610)',
    halo: 'radial-gradient(circle, rgba(192,48,74,0.5), transparent 70%)',
    glow: 'rgba(192,48,74,0.4)',
  },
]

export default function ColorsComparePage() {
  return (
    <div className="min-h-screen px-6 py-14 text-white" style={{ background: '#08070a' }}>
      <div className="mx-auto max-w-5xl">
        <h1 className="font-display text-3xl font-semibold tracking-tight">Direzioni colore — super premium</h1>
        <p className="mt-2 text-white/45">Base nera calda + una firma forte. (Dal vivo gli anelli ruotano: il riflesso scorre.)</p>

        <div className="mt-12 grid grid-cols-1 gap-x-10 gap-y-16 sm:grid-cols-2">
          {OPTIONS.map((o) => (
            <div key={o.n} className="flex flex-col items-center">
              <div className="relative h-[230px] w-[230px]">
                <span className="portal-pulse absolute -inset-10 rounded-full blur-[64px]" style={{ background: o.halo }} />
                <span className="portal-spin absolute inset-0 rounded-full" style={{ background: o.ring, boxShadow: `0 0 50px ${o.glow}` }} />
                <span className="absolute inset-[2px] flex flex-col items-center justify-center gap-2.5 rounded-full" style={{ background: 'radial-gradient(circle at 50% 35%, #16141a, #0a090c)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }}>
                  <Upload className="h-8 w-8" />
                  <span className="text-base font-semibold">Trascina la tua traccia</span>
                  <span className="text-sm text-white/40">MP3 · WAV — o clicca</span>
                </span>
              </div>
              <p className="mt-7 font-display text-lg font-semibold">{o.n}</p>
              <p className="mt-1 max-w-xs text-center text-sm text-white/50">{o.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
