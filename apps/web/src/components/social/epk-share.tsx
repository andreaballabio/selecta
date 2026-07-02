'use client'

import { useState } from 'react'
import { Link2, Copy, Check, Mail } from 'lucide-react'

/**
 * Condividi la press kit come EPK: copia il link, un testo già formattato da
 * incollare nelle DM alle label, oppure apri una bozza email pronta per l'A&R
 * (risolve il motivo di scarto "niente EPK"). Il link assoluto si costruisce
 * lato client da window.location.
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

  const mailToAr = () => {
    const url = `${window.location.origin}/u/${handle}`
    const subject = `Press kit — ${(text.split('\n')[0] || 'Selecta').slice(0, 60)}`
    const body = `${text}\n\nPress kit completo: ${url}`
    window.location.href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
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
      <button onClick={mailToAr} className={btn}>
        <Mail className="h-4 w-4" /> Scrivi all’A&R
      </button>
    </div>
  )
}
