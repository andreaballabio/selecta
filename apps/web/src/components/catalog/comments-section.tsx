'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Send, Trash2, MessageCircle } from 'lucide-react'

export interface CommentItem {
  id: string
  body: string
  created_at: string | null
  user_id?: string
  author_handle: string | null
  author_name: string | null
}

export function CommentsSection({
  submissionId, initialComments, meId,
}: { submissionId: string; initialComments: CommentItem[]; meId: string | null }) {
  const [comments, setComments] = useState<CommentItem[]>(initialComments)
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    const text = body.trim()
    if (!text) return
    setBusy(true)
    try {
      const res = await fetch('/api/catalog/comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submission_id: submissionId, body: text }),
      })
      if (res.status === 401) { window.location.href = '/auth/login'; return }
      const data = await res.json()
      if (data.comment) {
        setComments((prev) => [{ ...data.comment, user_id: meId ?? undefined }, ...prev])
        setBody('')
      }
    } finally { setBusy(false) }
  }

  const remove = async (id: string) => {
    setComments((prev) => prev.filter((c) => c.id !== id))
    await fetch('/api/catalog/comment', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: id }),
    }).catch(() => {})
  }

  return (
    <section className="mt-12">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-zinc-500">
        <MessageCircle className="h-4 w-4" /> Commenti {comments.length > 0 && `(${comments.length})`}
      </h2>

      {meId ? (
        <div className="mb-5 flex gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') submit() }}
            maxLength={600}
            placeholder="Scrivi un commento…"
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-emerald-500 focus:outline-none"
          />
          <button onClick={submit} disabled={busy || !body.trim()} className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50">
            <Send className="h-4 w-4" /> Invia
          </button>
        </div>
      ) : (
        <p className="mb-5 text-sm text-zinc-500">
          <Link href="/auth/login" className="text-emerald-400 hover:underline">Accedi</Link> per commentare.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-600">Ancora nessun commento. Scrivi il primo.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-zinc-300">
                  {c.author_handle ? (
                    <Link href={`/u/${c.author_handle}`} className="hover:text-emerald-400">{c.author_name || c.author_handle}</Link>
                  ) : (c.author_name || 'utente')}
                </span>
                {meId && c.user_id === meId && (
                  <button onClick={() => remove(c.id)} className="text-zinc-600 hover:text-red-400" aria-label="Elimina">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-zinc-400">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
