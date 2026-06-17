import Link from 'next/link'
import { Sparkles, Target, Radio, TrendingUp, IdCard, ArrowRight, Play } from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'

const STEPS = [
  { n: '01', title: 'Carica la demo', body: 'Trascina la tua traccia. L’AI estrae BPM, key, loudness e la firma timbrica del tuo sound.' },
  { n: '02', title: 'Scopri le label', body: 'Matching reale col catalogo: percentuali oneste, non tutte al 100%, con il perché di ogni match.' },
  { n: '03', title: 'Pubblica e cresci', body: 'Entra nel catalogo curato per suono. Stream, like, salvataggi dei DJ, classifiche, scouting.' },
]

const PILLARS = [
  { icon: Target, title: 'Analisi & Match', body: 'Un A&R virtuale che legge il tuo sound e ti dice quali label hanno più probabilità di firmarti — e perché.', href: '/match', cta: 'Analizza' },
  { icon: Radio, title: 'Catalogo per suono', body: 'La vetrina di Tech House non firmata, organizzata dall’AI per come suona. Niente firehose: curation.', href: '/catalog', cta: 'Esplora' },
  { icon: TrendingUp, title: 'Classifiche & community', body: 'Ascolti, like e salvataggi dei DJ fanno salire le tracce. Segui gli artisti, trova chi suona come te.', href: '/charts', cta: 'Classifiche' },
  { icon: IdCard, title: 'Press Kit', body: 'Una pagina condivisibile, auto-popolata dalle tue analisi, da mandare a locali, PR e label.', href: '/profile', cta: 'Crea la tua' },
]

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* HERO */}
      <section className="relative px-4 pt-20 pb-24 sm:px-6 sm:pt-28 lg:pt-32">
        <div className="mx-auto max-w-5xl text-center">
          <Reveal>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5">
              <Sparkles className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-medium text-emerald-300">AI A&R · Catalogo · Community — per Tech House</span>
            </div>
          </Reveal>

          <Reveal delay={60}>
            <h1 className="font-display text-5xl font-bold leading-[0.95] tracking-tight text-white sm:text-7xl lg:text-[5.5rem]">
              Il tuo sound trova
              <br />
              <span className="bg-gradient-to-r from-emerald-400 via-emerald-300 to-cyan-400 bg-clip-text text-transparent">
                la sua scena
              </span>
            </h1>
          </Reveal>

          <Reveal delay={140}>
            <p className="mx-auto mt-7 max-w-2xl text-lg text-zinc-400 sm:text-xl">
              Analizza la tua traccia, scopri le label compatibili e pubblicala in un catalogo
              curato per come suona — dove DJ e label ti ascoltano davvero.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/match" className="group inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 font-semibold text-black transition-all hover:bg-emerald-400">
                <Sparkles className="h-5 w-5" /> Analizza gratis
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/catalog" className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/60 px-7 py-3.5 font-semibold text-white transition-all hover:border-zinc-600">
                <Play className="h-4 w-4 text-emerald-400" /> Esplora il catalogo
              </Link>
            </div>
          </Reveal>

          <Reveal delay={300}>
            <p className="mt-6 text-sm text-zinc-600">Gratis per iniziare · Nessuna carta richiesta · Solo tracce originali</p>
          </Reveal>
        </div>
      </section>

      {/* COME FUNZIONA */}
      <section id="how-it-works" className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400/80">Come funziona</p>
            <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Dalla demo alla scena in tre passi</h2>
          </Reveal>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <Reveal key={s.n} delay={i * 90}>
                <div className="h-full rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-7">
                  <span className="font-display text-3xl font-bold text-emerald-400/40">{s.n}</span>
                  <h3 className="mt-3 text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-2 text-zinc-400">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* PILASTRI */}
      <section className="px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400/80">La piattaforma</p>
            <h2 className="max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">Un solo motore, quattro modi di crescere</h2>
          </Reveal>
          <div className="mt-12 grid gap-5 sm:grid-cols-2">
            {PILLARS.map((p, i) => (
              <Reveal key={p.title} delay={i * 80}>
                <Link href={p.href} className="group flex h-full flex-col rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-7 transition-all duration-300 hover:border-emerald-500/30 hover:bg-zinc-900/40">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10">
                    <p.icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white">{p.title}</h3>
                  <p className="mt-2 flex-1 text-zinc-400">{p.body}</p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400">
                    {p.cta} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* CTA FINALE */}
      <section className="px-4 py-20 sm:px-6">
        <Reveal>
          <div className="relative mx-auto max-w-4xl overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/40 to-black p-10 text-center sm:p-14">
            <div className="absolute inset-x-0 -top-24 mx-auto h-48 w-48 rounded-full bg-emerald-500/20 blur-3xl" />
            <div className="relative">
              <h2 className="font-display text-3xl font-bold text-white sm:text-4xl">Pronto a far sentire il tuo sound?</h2>
              <p className="mx-auto mt-3 max-w-xl text-zinc-400">Analizza la prima traccia adesso. In 90 secondi sai dove puoi firmare — e puoi entrare nel catalogo.</p>
              <Link href="/match" className="mt-7 inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-7 py-3.5 font-semibold text-black transition-all hover:bg-emerald-400">
                <Sparkles className="h-5 w-5" /> Inizia gratis
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-zinc-900 px-4 py-12 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
              <span className="flex items-end gap-0.5">
                {[0, 1, 2].map((i) => <span key={i} className="w-[3px] rounded-full bg-black" style={{ height: i === 1 ? 11 : 7 }} />)}
              </span>
            </span>
            <span className="font-display font-bold text-white">Selecta</span>
          </div>
          <p className="text-sm text-zinc-600">© 2026 Selecta · Costruito per i producer Tech House</p>
        </div>
      </footer>
    </div>
  )
}
