'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export function NotifBell() {
  const [unread, setUnread] = useState(0)
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setAuthed(true)
      const { count } = await (supabase as any).from('notifications').select('id', { count: 'exact', head: true }).eq('recipient_id', data.user.id).is('read_at', null)
      setUnread(count ?? 0)
    })
  }, [])

  if (!authed) return null
  return (
    <Link href="/notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted hover:text-text" aria-label="Notifiche">
      <Bell className="h-[18px] w-[18px]" />
      {unread > 0 && <span className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-ink">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  )
}
