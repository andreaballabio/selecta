'use client'

import { useEffect } from 'react'

/** Segna le notifiche come lette appena la pagina è visitata. */
export function MarkRead() {
  useEffect(() => { fetch('/api/notifications/read', { method: 'POST' }).catch(() => {}) }, [])
  return null
}
