import { ArrowRight, Sparkles } from 'lucide-react'
import { PreviewNav } from '@/components/marketing/preview-nav'

/* Opzione 1 — Tipografico estremo: il testo È l'hero. Minimale, premium. */
export default function Page() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-bg text-text">
      <PreviewNav label="1 · Tipografico estremo" />
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-4 text-center">
        <p className="a-in font-mono text-xs uppercase tracking-[0.3em] text-muted" style={{ animationDelay: '0.05s' }}>
          A&amp;R AI · Tech House
        </p>
        <h1 className="a-in font-display display-tight mt-7 text-[3.4rem] font-semibold leading-[0.88] sm:text-[7.5rem] sm:leading-[0.85]" style={{ animationDelay: '0.12s' }}>
          Fatti firmare.<br />Fatti sentire.
        </h1>
        <p className="a-in mt-8 max-w-md text-lg text-muted" style={{ animationDelay: '0.22s' }}>
          Carica la demo. In 30 secondi scopri quali label suonano come te.
        </p>
        <div className="a-in mt-11 flex flex-col items-center gap-4 sm:flex-row" style={{ animationDelay: '0.3s' }}>
          <button className="group inline-flex items-center gap-2 rounded-full bg-text px-8 py-4 text-[15px] font-semibold text-bg shadow-xl transition-transform hover:scale-[1.03]">
            Carica la tua demo <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </button>
          <button className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-text">
            <Sparkles className="h-4 w-4" /> prova una demo
          </button>
        </div>
      </section>
    </div>
  )
}
