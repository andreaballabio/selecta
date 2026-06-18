'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Radio, CheckCircle, Loader2, ExternalLink, LogIn } from 'lucide-react'

/**
 * Inviti il producer a pubblicare la traccia appena analizzata nel catalogo
 * pubblico (Fase 0: solo stream + like). Richiede login e consenso esplicito
 * (è l'autore di una traccia ORIGINALE e accetta i termini).
 */
export function PublishToCatalog({
  submissionId, defaultTitle, defaultArtist,
}: { submissionId: string; defaultTitle?: string; defaultArtist?: string }) {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [title, setTitle] = useState(defaultTitle ?? '')
  const [artist, setArtist] = useState(defaultArtist ?? '')
  const [coverUrl, setCoverUrl] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [published, setPublished] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setAuthed(!!data.user))
  }, [])

  const publish = async () => {
    setError(null)
    if (!consent) { setError('Conferma di essere l’autore e di accettare i termini.'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/catalog/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, title, artist, cover_url: coverUrl, consent: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Pubblicazione fallita')
      setPublished(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore')
    } finally {
      setBusy(false)
    }
  }

  if (published) {
    return (
      <div className="rounded-2xl border border-accent/30 bg-surface-2 p-6 text-center">
        <CheckCircle className="mx-auto mb-2 h-6 w-6 text-accent" />
        <p className="font-semibold text-text">Pubblicata nel catalogo 🎉</p>
        <p className="mt-1 text-sm text-muted">La tua traccia ora è ascoltabile da DJ e label.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link href={`/catalog/${submissionId}`} target="_blank" className="inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent">
            Vedi la pagina <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <Link href="/library" className="text-sm text-muted hover:text-text">Vai alla library</Link>
        </div>
      </div>
    )
  }

  if (authed === null) return null

  if (authed === false) {
    return (
      <div className="rounded-2xl border border-line bg-surface/60 p-6 text-center">
        <Radio className="mx-auto mb-2 h-6 w-6 text-accent" />
        <p className="font-semibold text-text">Pubblica nel catalogo</p>
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
          Accedi per pubblicare la tua traccia: la ascolteranno DJ e label. L’analisi resta collegata al tuo account.
        </p>
        <Link href="/auth/login" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent">
          <LogIn className="h-4 w-4" /> Accedi per pubblicare
        </Link>
      </div>
    )
  }

  const input = 'w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder-faint focus:border-accent focus:outline-none'

  return (
    <div className="rounded-2xl border border-line bg-surface/60 p-6">
      <div className="mb-4 flex items-center gap-2">
        <Radio className="h-5 w-5 text-accent" />
        <h3 className="font-semibold text-text">Pubblica nel catalogo</h3>
      </div>
      <p className="mb-4 text-sm text-muted">
        Entra nella vetrina pubblica organizzata per suono. Solo stream e like — niente download. Solo tracce originali.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titolo" />
        <input className={input} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artista" />
      </div>
      <input className={`${input} mt-3`} value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="URL copertina (opzionale)" />

      <label className="mt-4 flex cursor-pointer items-start gap-2 text-sm text-muted">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--accent)]" />
        <span>Sono l’autore di questa traccia originale e accetto i termini (concedo a Selecta la licenza per ospitarla e farla ascoltare in streaming).</span>
      </label>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <button
        onClick={publish}
        disabled={busy}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2.5 font-semibold text-accent-ink transition-colors hover:bg-accent disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
        {busy ? 'Pubblicazione…' : 'Pubblica nel catalogo'}
      </button>
    </div>
  )
}
