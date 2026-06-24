import { ArrowRight, Upload, Target, Play, TrendingUp } from 'lucide-react'
import { PreviewNav } from '@/components/marketing/preview-nav'

/* Opzione 3 — Bento: una griglia di tile glass che mostra tutto il valore a colpo d'occhio. */

const WAVE = Array.from({ length: 56 }, (_, i) => Math.round(18 + Math.abs(Math.sin(i * 0.5) * 0.5 + Math.sin(i * 0.17) * 0.32 + Math.cos(i * 0.09) * 0.2) * 80))

export default function Page() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      <PreviewNav label="3 · Bento" />
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-5 pt-28 pb-12">
        <h1 className="a-in font-display display-tight text-[2.6rem] font-semibold leading-[0.92] sm:text-[4.2rem] sm:leading-[0.9]">
          Fatti firmare. Fatti sentire.
        </h1>
        <p className="a-in mt-4 max-w-xl text-lg text-muted" style={{ animationDelay: '0.1s' }}>
          Carica la demo: l’AI trova le label che suonano come te.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-4 sm:grid-rows-2">
          {/* tile grande: upload */}
          <div className="a-in glass glass-hover col-span-1 flex flex-col justify-between rounded-3xl p-6 sm:col-span-2 sm:row-span-2" style={{ animationDelay: '0.16s' }}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs uppercase tracking-[0.2em] text-muted">Analizza</span>
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-text text-bg"><Upload className="h-5 w-5" /></span>
            </div>
            <div className="mt-8 flex h-20 items-center gap-[2px]">
              {WAVE.map((h, i) => <span key={i} className="w-[3px] flex-1 rounded-full" style={{ height: `${h}%`, background: i / WAVE.length < 0.42 ? 'var(--color-text)' : 'var(--color-wave)' }} />)}
            </div>
            <div className="mt-6">
              <p className="font-display text-2xl font-semibold tracking-tight">Trascina la tua demo</p>
              <p className="mt-1 text-sm text-faint">o clicca · MP3 · WAV · tutto lo schermo è dropzone</p>
              <button className="group mt-5 inline-flex items-center gap-2 rounded-full bg-text px-6 py-3 text-sm font-semibold text-bg transition-transform hover:scale-[1.03]">
                Analizza gratis <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          </div>

          {/* match */}
          <div className="a-in glass glass-hover rounded-3xl p-5 sm:col-span-2" style={{ animationDelay: '0.22s' }}>
            <div className="flex items-center gap-2 text-sm font-medium"><Target className="h-4 w-4 text-muted" /> Match label</div>
            <div className="mt-4 space-y-2.5">
              {[['Solid Grooves', 94], ['HOTTRAX', 88], ['Repop. Mars', 81]].map(([n, p]) => (
                <div key={n as string}>
                  <div className="mb-1 flex justify-between text-xs"><span className="font-medium">{n}</span><span className="font-mono text-muted">{p}%</span></div>
                  <div className="h-1.5 w-full rounded-full bg-surface-2"><div className="h-full rounded-full bg-text" style={{ width: `${p}%` }} /></div>
                </div>
              ))}
            </div>
          </div>

          {/* now playing */}
          <div className="a-in glass glass-hover flex items-center gap-3 rounded-3xl p-5" style={{ animationDelay: '0.28s' }}>
            <button className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-text text-bg"><Play className="h-5 w-5 translate-x-px" /></button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">Nightshift</p>
              <div className="mt-1.5 flex h-5 items-center gap-[2px]">
                {WAVE.slice(0, 36).map((h, i) => <span key={i} className="w-[2px] flex-1 rounded-full" style={{ height: `${h}%`, background: i < 14 ? 'var(--color-text)' : 'var(--color-wave)' }} />)}
              </div>
            </div>
          </div>

          {/* stat */}
          <div className="a-in glass glass-hover flex items-center justify-between rounded-3xl p-5" style={{ animationDelay: '0.34s' }}>
            <div><p className="font-display text-3xl font-semibold tracking-tight">71%</p><p className="font-mono text-[11px] uppercase tracking-wide text-faint">precision@5</p></div>
            <TrendingUp className="h-6 w-6 text-muted" />
          </div>
        </div>
      </section>
    </div>
  )
}
