'use client'

import { useEffect, useRef, useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Msg { id: string; sender_id: string; recipient_id: string; body: string; created_at: string }

export function MessageThread({ meId, otherId }: { meId: string; otherId: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const endRef = useRef<HTMLDivElement | null>(null)
  const supabase = createClient()

  const load = async () => {
    const { data } = await (supabase as any).from('messages')
      .select('id, sender_id, recipient_id, body, created_at')
      .or(`and(sender_id.eq.${meId},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${meId})`)
      .order('created_at', { ascending: true }).limit(200)
    setMessages((data as Msg[]) ?? [])
    // segna letti
    await (supabase as any).from('messages').update({ read_at: new Date().toISOString() }).eq('recipient_id', meId).eq('sender_id', otherId).is('read_at', null)
  }

  useEffect(() => { load(); const id = setInterval(load, 5000); return () => clearInterval(id) /* eslint-disable-next-line */ }, [meId, otherId])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages.length])

  const send = async () => {
    const body = text.trim(); if (!body) return
    setSending(true)
    try {
      const res = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient_id: otherId, body }) })
      const d = await res.json()
      if (d.message) { setMessages((m) => [...m, d.message]); setText('') }
    } finally { setSending(false) }
  }

  return (
    <div className="flex h-[calc(100vh-16rem)] flex-col rounded-2xl border border-line bg-surface/40">
      <div className="flex-1 space-y-2 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted">Nessun messaggio. Scrivi il primo.</p>
        ) : messages.map((m) => {
          const mine = m.sender_id === meId
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${mine ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-text'}`}>
                {m.body}
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>
      <div className="flex items-center gap-2 border-t border-line p-3">
        <input
          value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
          placeholder="Scrivi un messaggio…"
          className="flex-1 rounded-full border border-line bg-surface-2 px-4 py-2.5 text-sm text-text placeholder-faint focus:border-accent focus:outline-none"
        />
        <button onClick={send} disabled={sending || !text.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-accent-ink disabled:opacity-50" aria-label="Invia">
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}
