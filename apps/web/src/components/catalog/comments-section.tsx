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
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
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
            className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 text-sm text-text placeholder-faint focus:border-accent focus:outline-none"
          />
          <button onClick={submit} disabled={busy || !body.trim()} className="flex items-center gap-1.5 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-accent-ink hover:bg-accent disabled:opacity-50">
            <Send className="h-4 w-4" /> Invia
          </button>
        </div>
      ) : (
        <p className="mb-5 text-sm text-muted">
          <Link href="/auth/login" className="text-accent hover:underline">Accedi</Link> per commentare.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-faint">Ancora nessun commento. Scrivi il primo.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li key={c.id} className="rounded-xl border border-line bg-surface/50 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-text">
                  {c.author_handle ? (
                    <Link href={`/u/${c.author_handle}`} className="hover:text-accent">{c.author_name || c.author_handle}</Link>
                  ) : (c.author_name || 'utente')}
                </span>
                {meId && c.user_id === meId && (
                  <button onClick={() => remove(c.id)} className="text-faint hover:text-red-400" aria-label="Elimina">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <p className="mt-1 whitespace-pre-line text-sm text-muted">{c.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
