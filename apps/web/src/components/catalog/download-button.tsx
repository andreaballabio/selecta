'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Lock, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function DownloadButton({ submissionId, versionId, label, small }: { submissionId: string; versionId?: string; label?: string; small?: boolean }) {
  const router = useRouter()
  const [canDl, setCanDl] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) { setCanDl(false); return }
      const { data: s } = await (sb as any).from('subscriptions').select('tier, status').eq('user_id', data.user.id).maybeSingle()
      setCanDl(!!s && s.status === 'active' && (s.tier === 'dj-pool' || s.tier === 'label'))
    })
  }, [])

  const download = async () => {
    if (!canDl) { router.push('/pricing'); return }
    setBusy(true)
    try {
      const res = await fetch('/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId, version_id: versionId }) })
      if (res.status === 402) { router.push('/pricing'); return }
      const d = await res.json()
      if (!d.url) return
      // Forza il download col nome file
      const blob = await fetch(d.url).then((r) => r.blob())
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = d.filename || 'track.mp3'
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(a.href), 4000)
    } finally { setBusy(false) }
  }

  const cls = small
    ? 'flex items-center gap-1.5 text-sm text-muted hover:text-accent'
    : `flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm ${canDl ? 'border-line text-text hover:border-faint' : 'border-line text-muted hover:text-text'}`

  return (
    <button onClick={download} disabled={busy} className={cls} aria-label="Scarica">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : canDl ? <Download className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
      {!small && (canDl ? 'Scarica' : 'Scarica (DJ Pool)')}
      {small && (label ?? 'WAV/MP3')}
    </button>
  )
}
