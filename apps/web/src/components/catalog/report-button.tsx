'use client'

import { useState } from 'react'
import { Flag, Loader2, Check } from 'lucide-react'

const REASONS = ['copyright', 'non originale', 'contenuto offensivo', 'spam', 'altro']

export function ReportButton({ submissionId }: { submissionId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState(REASONS[0])
  const [details, setDetails] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')

  const send = async () => {
    setState('sending')
    try {
      await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId, reason, details }) })
      setState('sent')
    } catch { setState('idle') }
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-1.5 text-xs text-faint hover:text-text" aria-label="Segnala">
        <Flag className="h-3.5 w-3.5" /> Segnala
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-30 w-64 rounded-xl border border-line bg-surface p-3 shadow-2xl">
          {state === 'sent' ? (
            <p className="flex items-center gap-2 text-sm text-text"><Check className="h-4 w-4 text-accent" /> Grazie, l’abbiamo ricevuta.</p>
          ) : (
            <>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Motivo</p>
              <select value={reason} onChange={(e) => setReason(e.target.value)} className="w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text capitalize focus:border-accent focus:outline-none">
                {REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Dettagli (opzionale)" maxLength={1000} className="mt-2 min-h-[60px] w-full rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder-faint focus:border-accent focus:outline-none" />
              <button onClick={send} disabled={state === 'sending'} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-sm font-semibold text-accent-ink disabled:opacity-50">
                {state === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Flag className="h-4 w-4" />} Invia segnalazione
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
