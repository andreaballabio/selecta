'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Check, Loader2 } from 'lucide-react'

export function ReportActions({ reportId, submissionId }: { reportId: string; submissionId: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const act = async (action: 'unpublish' | 'resolve') => {
    setBusy(action)
    try {
      await fetch('/api/admin/moderate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, report_id: reportId, submission_id: submissionId }) })
      router.refresh()
    } finally { setBusy(null) }
  }

  return (
    <div className="flex shrink-0 items-center gap-2">
      <button onClick={() => act('unpublish')} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:border-red-500/50 disabled:opacity-50">
        {busy === 'unpublish' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Rimuovi
      </button>
      <button onClick={() => act('resolve')} disabled={!!busy} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-text disabled:opacity-50">
        {busy === 'resolve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Ignora
      </button>
    </div>
  )
}
