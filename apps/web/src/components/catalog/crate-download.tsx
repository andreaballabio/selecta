'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

/** Scarica in blocco tutte le tracce del crate (gated dal DJ Pool, simulato). */
export function CrateDownload({ trackIds }: { trackIds: string[] }) {
  const router = useRouter()
  const [canDl, setCanDl] = useState(false)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: s } = await (sb as any).from('subscriptions').select('tier, status').eq('user_id', data.user.id).maybeSingle()
      setCanDl(!!s && s.status === 'active' && (s.tier === 'dj-pool' || s.tier === 'label'))
    })
  }, [])

  const run = async () => {
    if (!canDl) { router.push('/pricing'); return }
    setBusy(true); setDone(0)
    try {
      for (const id of trackIds) {
        const res = await fetch('/api/downloads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: id }) })
        if (res.status === 402) { router.push('/pricing'); return }
        const d = await res.json()
        if (d.url) {
          const blob = await fetch(d.url).then((r) => r.blob())
          const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = d.filename || 'track.mp3'
          document.body.appendChild(a); a.click(); a.remove()
          setTimeout(() => URL.revokeObjectURL(a.href), 4000)
          setDone((n) => n + 1)
          await new Promise((r) => setTimeout(r, 700))
        }
      }
    } finally { setBusy(false) }
  }

  if (trackIds.length === 0) return null
  return (
    <button onClick={run} disabled={busy} className="flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-semibold text-text hover:border-faint disabled:opacity-60">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? `Scarico… ${done}/${trackIds.length}` : 'Scarica il crate'}
    </button>
  )
}
