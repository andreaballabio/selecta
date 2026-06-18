import Link from 'next/link'
import {
  ArrowRight, ArrowUpRight, Sparkles, Target, Radio, TrendingUp, IdCard, Gauge,
  Check, Lock, Headphones, Disc3, Star,
} from 'lucide-react'
import { Reveal } from '@/components/ui/reveal'
import { Faq } from '@/components/marketing/faq'
import { StatCounter } from '@/components/marketing/stat-counter'
import { CatalogGrid, type CatalogTrack } from '@/components/catalog/catalog-grid'
import { createAdminClient } from '@/lib/supabase/admin'
import { hotScore } from '@/lib/social'

export const dynamic = 'force-dynamic'

const SELECT = 'id, display_title, display_artist, cover_url, file_url, bpm, key, scale, genre, sound_bucket, likes_count, saves_count, play_count, published_at'

async function getData() {
  const sb = createAdminClient()
  const [pub, artists, analyzed, top] = await Promise.all([
    sb.from('user_submissions').select('id', { count: 'exact', head: true }).eq('published', true),
    sb.from('artist_profiles').select('user_id', { count: 'exact', head: true }),
    sb.from('user_submissions').select('id', { count: 'exact', head: true }).eq('analysis_status', 'analyzed'),
    sb.from('user_submissions').select(SELECT).eq('published', true).order('likes_count', { ascending: false }).limit(12),
  ])
  const topTracks = ((top.data ?? []) as (CatalogTrack & { published_at: string })[])
    .sort((a, b) => hotScore(b) - hotScore(a))
    .slice(0, 4)
  return {
    publishedCount: pub.count ?? 0,
    artistsCount: artists.count ?? 0,
    analyzedCount: analyzed.count ?? 0,
    topTracks,
  }
}

const ECOSYSTEM = ['Spotify', 'SoundCloud', 'Beatport', 'Bandcamp', 'Traxsource', 'Resident Advisor', 'Apple Music', 'YouTube']

const FEATURES = [
  { icon: Target, title: 'Match con le label', body: 'Carichi la demo, l’AI legge la firma timbrica e ti dice quali etichette suonano come te — con percentuali oneste e il perché.' },
  { icon: Gauge, title: 'Report tecnico PRO', body: 'LUFS, true peak, dinamica, profilo spettrale: capisci se il tuo master è pronto per la pista o per lo streaming.' },
  { icon: Radio, title: 'Catalogo per suono', body: 'Pubblichi nella library curata dall’AI per come suona. Niente firehose: solo Tech House organizzata bene.' },
  { icon: TrendingUp, title: 'Classifiche reali', body: 'Ascolti, like e salvataggi dei DJ fanno salire le tracce. Le classifiche che le label guardano.' },
  { icon: IdCard, title: 'Press Kit', body: 'Una pagina condivisibile, auto-popolata dal tuo Sound DNA, da mandare a locali, PR ed etichette.' },
  { icon: Headphones, title: 'Community di selectors', body: 'Segui gli artisti, trova chi suona come te, fatti scoprire da DJ e A&R che cercano sound nuovo.' },
]

const PERSONAS = [
  { tag: 'Producer', quote: 'Capisci in 90 secondi dove puoi firmare e costruisci un’identità che le label riconoscono.' },
  { tag: 'DJ / Selector', quote: 'Pesca sound fresco non ancora firmato, organizzato per come suona davvero.' },
  { tag: 'A&R / Label', quote: 'Sfoglia un catalogo pre-filtrato sul tuo stile e intercetta le tracce in salita.' },
]

const PRICING = [
  {
    name: 'Free', price: '€0', cadence: 'per sempre', highlight: false,
    features: ['Analisi audio + match con le label', 'Pubblica nel catalogo', 'Press Kit condivisibile', 'Like, salvataggi, classifiche'],
    cta: 'Inizia gratis', href: '/match', soon: false,
  },
  {
    name: 'Pro', price: '€9', cadence: 'al mese', highlight: true,
    features: ['Tutto del Free', 'Report tecnico PRO completo', 'Statistiche avanzate sulle tue tracce', 'Featured nel catalogo + priorità scouting'],
    cta: 'In arrivo', href: '/match', soon: true,
  },
  {
    name: 'Label', price: 'Su misura', cadence: 'B2B', highlight: false,
    features: ['Dashboard di scouting', 'Catalogo pre-filtrato sul tuo sound', 'Classifiche e tracce emergenti', 'Contatto diretto con i producer'],
    cta: 'Contattaci', href: 'mailto:hello@selecta.app', soon: true,
  },
]

export default async function HomePage() {
  const { publishedCount, artistsCount, analyzedCount, topTracks } = await getData()

  return (
    <div className="relative overflow-hidden">
      {/* ───────── HERO ───────── */}
      <section className="relative px-4 pt-16 pb-20 sm:px-8 sm:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-0 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="relative mx-auto max-w-5xl text-center">
          <Reveal>
            <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-4 py-1.5">
              <span className="flex h-2 w-2 rounded-full bg-accent" />
              <span className="text-sm font-medium text-muted">A&R AI · Catalogo · Community — Tech House</span>
            </div>
          </Reveal>
          <Reveal delay={70}>
            <h1 className="font-display text-[3.25rem] font-extrabold leading-[0.92] tracking-tight text-text sm:text-7xl lg:text-[6rem]">
              Fatti firmare.
              <br />
              <span className="text-accent">Fatti sentire.</span>
            </h1>
          </Reveal>
          <Reveal delay={140}>
            <p className="mx-auto mt-7 max-w-xl text-lg text-muted sm:text-xl">
              Selecta analizza il tuo sound, ti dice quali label possono firmarti
              e ti porta in un catalogo dove DJ ed etichette ascoltano davvero.
            </p>
          </Reveal>
          <Reveal delay={210}>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href="/match" className="group inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink transition-transform hover:scale-[1.03]">
                Analizza gratis la tua traccia
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <Link href="/library" className="inline-flex items-center gap-2 rounded-full border border-line px-7 py-3.5 font-semibold text-text transition-colors hover:border-faint">
                <Disc3 className="h-4 w-4 text-accent" /> Esplora la library
              </Link>
            </div>
          </Reveal>
          <Reveal delay={280}>
            <p className="mt-5 text-sm text-faint">Gratis · Nessuna carta · Solo tracce originali</p>
          </Reveal>
        </div>
      </section>

      {/* ───────── ECOSISTEMA (marquee) ───────── */}
      <section className="border-y border-line py-7">
        <p className="mb-5 text-center text-xs font-medium uppercase tracking-[0.25em] text-faint">Pensata per l’ecosistema in cui pubblichi</p>
        <div className="marquee-mask overflow-hidden">
          <div className="marquee-track flex w-max items-center gap-12">
            {[...ECOSYSTEM, ...ECOSYSTEM].map((p, i) => (
              <span key={i} className="font-display text-xl font-bold text-faint/70">{p}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── STATS REALI ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { v: analyzedCount, label: 'Tracce analizzate' },
            { v: publishedCount, label: 'Nel catalogo' },
            { v: artistsCount, label: 'Artisti' },
            { v: 64, label: 'Dimensioni del fingerprint' },
          ].map((s, i) => (
            <Reveal key={s.label} delay={i * 70}>
              <div className="text-center sm:text-left">
                <p className="font-display text-4xl font-bold text-text sm:text-5xl"><StatCounter value={s.v} /></p>
                <p className="mt-1 text-sm text-muted">{s.label}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ───────── HOOK GRATUITO ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[2rem] border border-accent/25 bg-gradient-to-br from-accent/[0.08] via-surface to-bg p-8 sm:p-14">
            <div className="grid items-center gap-8 lg:grid-cols-2">
              <div>
                <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-accent">
                  <Sparkles className="h-3.5 w-3.5" /> Gratis, per sempre
                </p>
                <h2 className="font-display text-4xl font-bold leading-tight text-text sm:text-5xl">La tua traccia è da firmare?</h2>
                <p className="mt-4 max-w-md text-lg text-muted">
                  Caricala. In 90 secondi sai quali label suonano come te, quanto sei compatibile e cosa sistemare nel mix. Zero costi, zero impegno.
                </p>
                <Link href="/match" className="mt-7 inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 font-semibold text-accent-ink transition-transform hover:scale-[1.03]">
                  Scoprilo ora <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="space-y-3">
                {[
                  { k: 'Match', v: 'Le label compatibili col tuo sound' },
                  { k: 'Report', v: 'LUFS, true peak, dinamica del master' },
                  { k: 'Sound DNA', v: 'La firma timbrica della tua musica' },
                ].map((r) => (
                  <div key={r.k} className="flex items-center gap-4 rounded-2xl border border-line bg-bg/40 px-5 py-4">
                    <span className="font-display text-sm font-bold uppercase tracking-wider text-accent">{r.k}</span>
                    <span className="text-muted">{r.v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── FEATURES ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">La piattaforma</p>
            <h2 className="max-w-2xl font-display text-4xl font-bold text-text sm:text-5xl">Tutto quello che serve al tuo sound</h2>
          </Reveal>
          <div className="mt-12 grid gap-px overflow-hidden rounded-3xl border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 70}>
                <div className="group h-full bg-bg p-7 transition-colors hover:bg-surface">
                  <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-accent ring-1 ring-line">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-lg font-semibold text-text">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{f.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── CLASSIFICA LIVE ───────── */}
      {topTracks.length > 0 && (
        <section className="px-4 py-16 sm:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal>
              <div className="mb-10 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">In classifica ora</p>
                  <h2 className="font-display text-4xl font-bold text-text sm:text-5xl">Cosa sta girando</h2>
                </div>
                <Link href="/charts" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-text">
                  Tutte le classifiche <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
            </Reveal>
            <Reveal delay={80}><CatalogGrid tracks={topTracks} /></Reveal>
          </div>
        </section>
      )}

      {/* ───────── ESCLUSIVITÀ ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <Reveal>
          <div className="mx-auto max-w-5xl rounded-[2rem] border border-line bg-surface/40 p-10 text-center sm:p-16">
            <Lock className="mx-auto mb-5 h-7 w-7 text-accent" />
            <h2 className="mx-auto max-w-3xl font-display text-3xl font-bold leading-tight text-text sm:text-[2.75rem]">
              Curato, non un firehose. Qui ci sono solo originali, organizzati per come suonano.
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-muted">
              Niente migliaia di upload casuali. L’AI fa da filtro di qualità e da bussola: la curation è il prodotto. È per questo che le label guardano.
            </p>
          </div>
        </Reveal>
      </section>

      {/* ───────── SOCIAL PROOF (placeholder) ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mb-10 flex items-center gap-4">
              <div className="flex -space-x-3">
                {['A', 'M', 'L', 'K', 'R'].map((c) => (
                  <span key={c} className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-bg bg-surface-2 font-display text-sm font-bold text-faint">{c}</span>
                ))}
              </div>
              <p className="text-muted">Producer, DJ e A&R stanno costruendo qui il loro sound.</p>
            </div>
          </Reveal>
          <div className="grid gap-5 md:grid-cols-3">
            {PERSONAS.map((p, i) => (
              <Reveal key={p.tag} delay={i * 80}>
                <div className="flex h-full flex-col rounded-3xl border border-line bg-surface/40 p-7">
                  <Star className="mb-4 h-5 w-5 text-accent" />
                  <p className="flex-1 text-lg leading-relaxed text-text">“{p.quote}”</p>
                  <p className="mt-5 text-sm font-semibold uppercase tracking-wider text-faint">{p.tag}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── PRICING ───────── */}
      <section id="pricing" className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal>
            <div className="mb-12 text-center">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Prezzi</p>
              <h2 className="font-display text-4xl font-bold text-text sm:text-5xl">Inizia gratis. Cresci quando vuoi.</h2>
            </div>
          </Reveal>
          <div className="grid gap-5 lg:grid-cols-3">
            {PRICING.map((t, i) => (
              <Reveal key={t.name} delay={i * 80}>
                <div className={`flex h-full flex-col rounded-3xl border p-7 ${t.highlight ? 'border-accent/40 bg-accent/[0.04] accent-glow' : 'border-line bg-surface/40'}`}>
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-xl font-bold text-text">{t.name}</h3>
                    {t.highlight && <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-bold text-accent-ink">Popolare</span>}
                  </div>
                  <div className="mt-4 flex items-end gap-1.5">
                    <span className="font-display text-4xl font-bold text-text">{t.price}</span>
                    <span className="mb-1 text-sm text-muted">{t.cadence}</span>
                  </div>
                  <ul className="mt-6 flex-1 space-y-3">
                    {t.features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-sm text-muted">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-accent" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={t.href}
                    className={`mt-7 inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-all ${
                      t.highlight ? 'bg-accent text-accent-ink hover:scale-[1.02]' : 'border border-line text-text hover:border-faint'
                    }`}
                  >
                    {t.cta}{t.soon && <span className="text-xs opacity-70">· presto</span>}
                  </Link>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ───────── FAQ ───────── */}
      <section className="px-4 py-16 sm:px-8">
        <div className="mx-auto max-w-3xl">
          <Reveal>
            <div className="mb-10 text-center">
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">FAQ</p>
              <h2 className="font-display text-4xl font-bold text-text sm:text-5xl">Domande frequenti</h2>
            </div>
          </Reveal>
          <Reveal delay={80}><Faq /></Reveal>
        </div>
      </section>

      {/* ───────── CTA FINALE ───────── */}
      <section className="px-4 py-20 sm:px-8">
        <Reveal>
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-line bg-surface/50 p-12 text-center sm:p-20">
            <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative">
              <h2 className="mx-auto max-w-2xl font-display text-4xl font-bold leading-tight text-text sm:text-6xl">Il prossimo firmato potresti essere tu.</h2>
              <Link href="/match" className="mt-8 inline-flex items-center gap-2 rounded-full bg-accent px-8 py-4 font-semibold text-accent-ink transition-transform hover:scale-[1.03]">
                Analizza gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────── FOOTER ───────── */}
      <footer className="border-t border-line px-4 py-12 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent">
              <span className="flex items-end gap-[2px]">
                {[7, 11, 7].map((h, i) => <span key={i} className="w-[3px] rounded-full bg-accent-ink" style={{ height: h }} />)}
              </span>
            </span>
            <span className="font-display font-bold text-text">Selecta</span>
          </div>
          <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted">
            <Link href="/match" className="hover:text-text">Analizza</Link>
            <Link href="/library" className="hover:text-text">Library</Link>
            <Link href="/charts" className="hover:text-text">Classifiche</Link>
            <Link href="/artists" className="hover:text-text">Artisti</Link>
            <Link href="/pricing" className="hover:text-text">Prezzi</Link>
            <Link href="/terms" className="hover:text-text">Termini</Link>
            <Link href="/privacy" className="hover:text-text">Privacy</Link>
          </nav>
          <p className="text-sm text-faint">© 2026 Selecta · Tech House</p>
        </div>
      </footer>
    </div>
  )
}
