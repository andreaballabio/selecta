import Link from 'next/link'
import { Sparkles, BarChart3, Target, Zap } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="min-h-screen bg-black">
      {/* Hero */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-900/20 via-black to-black" />
        
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">AI A&R per Tech House Producers</span>
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-white sm:text-6xl lg:text-7xl">
            Scopri quale label{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
              firmerà
            </span>{' '}
            la tua track
          </h1>

          <p className="mx-auto mb-10 max-w-2xl text-lg text-zinc-400">
            Selecta analizza il tuo sound con AI e ti dice con precisione reale 
            quali label hanno più probabilità di ascoltarti — e perché.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-4 font-semibold text-black transition-all hover:bg-emerald-400"
            >
              <Zap className="h-5 w-5" />
              Inizia Gratis
            </Link>
            
            <Link
              href="#how-it-works"
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-8 py-4 font-semibold text-white transition-all hover:border-zinc-700"
            >
              Scopri come funziona
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="how-it-works" className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="mb-4 text-3xl font-bold text-white">Come funziona</h2>
            <p className="mx-auto max-w-2xl text-zinc-400">
              Un sistema completo che va oltre la semplice analisi tecnica
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10">
                <BarChart3 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Analisi Audio Deep</h3>
              <p className="text-zinc-400">
                Estraiamo BPM, key, LUFS, energy curve e spectral features 
                per una profilazione completa del tuo sound.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10">
                <Target className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Label Matching</h3>
              <p className="text-zinc-400">
                Algoritmo proprietario che calcola sound match, accessibility 
                e trend alignment per ogni label nel database.
              </p>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500/10">
                <Sparkles className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="mb-3 text-xl font-semibold text-white">Feedback A&R</h3>
              <p className="text-zinc-400">
                Un AI A&R virtuale che ti dà feedback professionale, 
                suggerimenti concreti e strategia di demo submission.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-24 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-emerald-950/50 to-black p-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">Pronto a scoprire dove firmare?</h2>
          <p className="mx-auto mb-8 max-w-xl text-zinc-400">
            Inizia gratis con 3 analisi al mese. Nessuna carta di credito richiesta.
          </p>
          
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-8 py-4 font-semibold text-black transition-all hover:bg-emerald-400"
          >
            <Sparkles className="h-5 w-5" />
            Prova Selecta Ora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-900 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500">
                <Sparkles className="h-4 w-4 text-black" />
              </div>
              <span className="font-bold text-white">Selecta</span>
            </div>
            
            <p className="text-sm text-zinc-600">
              2026 Selecta. Built for tech house producers.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
