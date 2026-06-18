'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'

export function FollowButton({
  targetUserId, initialFollowing, initialFollowers, isSelf = false, compact = false,
}: {
  targetUserId: string
  initialFollowing: boolean
  initialFollowers?: number
  isSelf?: boolean
  compact?: boolean
}) {
  const [following, setFollowing] = useState(initialFollowing)
  const [followers, setFollowers] = useState(initialFollowers ?? 0)
  const [busy, setBusy] = useState(false)

  if (isSelf) return null

  const toggle = async () => {
    setBusy(true)
    const was = following
    setFollowing(!was)
    setFollowers((n) => Math.max(0, n + (was ? -1 : 1)))
    try {
      const res = await fetch('/api/social/follow', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId }),
      })
      if (res.status === 401) { window.location.href = '/auth/login'; return }
      const data = await res.json()
      if (typeof data.following === 'boolean') setFollowing(data.following)
      if (typeof data.followers_count === 'number') setFollowers(data.followers_count)
    } catch {
      setFollowing(was) // rollback
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-60 ${
        compact ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm'
      } ${following
        ? 'border border-faint text-text hover:border-faint'
        : 'bg-accent text-accent-ink hover:bg-accent'}`}
    >
      {following ? <UserCheck className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
      {following ? 'Segui già' : 'Segui'}
      {!compact && initialFollowers !== undefined && <span className="text-muted">· {followers}</span>}
    </button>
  )
}
