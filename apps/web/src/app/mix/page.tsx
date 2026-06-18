import Link from 'next/link'
import type { Metadata } from 'next'
import { Sparkles, LogIn } from 'lucide-react'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { getMixForUser } from '@/lib/mix'
import { AppShell } from '@/components/app/app-shell'
import { PlayAllList } from '@/components/catalog/play-all'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Per te — Selecta' }

export default async function MixPage() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()

  if (!user) {
    return (
      <AppShell>
        <div className="rounded-3xl border border-line bg-surface/40 p-12 text-center">
          <Sparkles className="mx-auto mb-3 h-7 w-7 text-accent" />
          <h1 className="font-display text-3xl font-bold text-text">Il tuo Mix personale</h1>
          <p className="mx-auto mt-2 max-w-sm text-muted">Accedi: impariamo dai tuoi like e salvataggi per consigliarti tracce che suonano come ciò che ami.</p>
          <Link href="/auth/login" className="mt-5 inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 font-semibold text-accent-ink"><LogIn className="h-4 w-4" /> Accedi</Link>
        </div>
      </AppShell>
    )
  }

  const { tracks, cold } = await getMixForUser(user.id, 30)

  return (
    <AppShell>
      <header className="mb-6">
        <p className="mb-2 text-sm font-semibold uppercase tracking-[0.2em] text-accent">Per te</p>
        <h1 className="font-display text-4xl font-bold tracking-tight text-text sm:text-5xl">Il tuo Mix</h1>
        <p className="mt-2 max-w-xl text-muted">Tracce scelte sul tuo gusto — dai like e dai salvataggi.</p>
      </header>

      {cold ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-10 text-center text-muted">
          Metti like o salva qualche traccia nel <Link href="/library" className="text-accent hover:underline">catalogo</Link> e qui comparirà il tuo Mix.
        </div>
      ) : tracks.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-line bg-surface/40 p-10 text-center text-muted">Ancora poche tracce simili. Torna presto.</div>
      ) : (
        <PlayAllList tracks={tracks} label="Riproduci il Mix" />
      )}
    </AppShell>
  )
}
