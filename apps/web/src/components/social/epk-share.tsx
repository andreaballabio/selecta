'use client'

import { useState } from 'react'
import { Link2, Copy, Check } from 'lucide-react'

/**
 * Condividi la press kit come EPK: copia il link, o un testo già formattato da
 * incollare nelle email/DM alle label (risolve il motivo di scarto "niente EPK").
 * Il link assoluto si costruisce lato client da window.location.
 */
export function EpkShare({ handle, text }: { handle: string; text: string }) {
  const [copied, setCopied] = useState<'link' | 'text' | null>(null)

  const copy = async (what: 'link' | 'text') => {
    const url = `${window.location.origin}/u/${handle}`
    const payload = what === 'link' ? url : `${text}\n${url}`
    try {
      await navigator.clipboard.writeText(payload)
      setCopied(what); setTimeout(() => setCopied(null), 2000)
    } catch { /* clipboard non disponibile */ }
  }

  const btn = 'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface/60 px-3 py-2 text-sm font-medium text-text transition-colors hover:border-faint'

  return (
    <div className="flex flex-wrap gap-2">
      <button onClick={() => copy('link')} className={btn}>
        {copied === 'link' ? <Check className="h-4 w-4 text-accent" /> : <Link2 className="h-4 w-4" />}
        {copied === 'link' ? 'Link copiato' : 'Copia link'}
      </button>
      <button onClick={() => copy('text')} className={btn}>
        {copied === 'text' ? <Check className="h-4 w-4 text-accent" /> : <Copy className="h-4 w-4" />}
        {copied === 'text' ? 'EPK copiato' : 'Copia EPK (testo)'}
      </button>
    </div>
  )
}
