'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Users2 } from 'lucide-react'

interface Peer { handle: string; name: string; affinity: number }

/** "Producer dal suono simile" — grafo per timbro. Si nasconde se non ci sono peer. */
export function SimilarArtists({ userId }: { userId: string }) {
  const [peers, setPeers] = useState<Peer[] | null>(null)

  useEffect(() => {
    let on = true
    fetch(`/api/artists/similar?user=${userId}`, { cache: 'no-store' })
      .then((r) => r.json()).then((d) => { if (on) setPeers(d.peers ?? []) })
      .catch(() => { if (on) setPeers([]) })
    return () => { on = false }
  }, [userId])

  if (!peers || peers.length === 0) return null

  return (
    <section className="mb-6 rounded-2xl border border-line bg-surface/60 p-5">
      <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted">
        <Users2 className="h-3.5 w-3.5 text-accent" /> Producer dal suono simile
      </p>
      <div className="flex flex-wrap gap-2">
        {peers.map((p) => (
          <Link key={p.handle} href={`/u/${p.handle}`}
            className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-sm text-text transition-colors hover:border-accent/50">
            <span className="font-medium group-hover:text-accent">{p.name}</span>
            <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold text-accent">{p.affinity}%</span>
          </Link>
        ))}
      </div>
    </section>
  )
}
