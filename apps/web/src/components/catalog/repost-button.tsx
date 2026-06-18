'use client'

import { useEffect, useState } from 'react'
import { Repeat2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function RepostButton({ submissionId, initialCount = 0 }: { submissionId: string; initialCount?: number }) {
  const [reposted, setReposted] = useState(false)
  const [count, setCount] = useState(initialCount)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const sb = createClient()
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setAuthed(true)
      const { data: r } = await (sb as any).from('reposts').select('id').eq('submission_id', submissionId).eq('user_id', data.user.id).maybeSingle()
      setReposted(!!r)
    })
  }, [submissionId])

  const toggle = async () => {
    if (!authed) { window.location.href = '/auth/login'; return }
    const was = reposted
    setReposted(!was); setCount((c) => Math.max(0, c + (was ? -1 : 1)))
    try {
      const res = await fetch('/api/catalog/repost', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ submission_id: submissionId }) })
      const d = await res.json()
      if (typeof d.reposts_count === 'number') setCount(d.reposts_count)
      if (typeof d.reposted === 'boolean') setReposted(d.reposted)
    } catch { /* noop */ }
  }

  return (
    <button onClick={toggle} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors ${reposted ? 'border-accent/40 text-accent' : 'border-line text-text hover:border-faint'}`} aria-label="Repost">
      <Repeat2 className="h-4 w-4" /> Repost{count > 0 && <span className="text-muted">· {count}</span>}
    </button>
  )
}
