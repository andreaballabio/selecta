import type { createAdminClient } from './supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

/** Inserisce una notifica (salta se manca il destinatario o coincide con l'attore). */
export async function notify(
  sb: Admin,
  opts: { recipient?: string | null; actor: string; type: 'like' | 'follow' | 'comment' | 'repost'; submissionId?: string | null },
) {
  if (!opts.recipient || opts.recipient === opts.actor) return
  try {
    await sb.from('notifications').insert({
      recipient_id: opts.recipient, actor_id: opts.actor, type: opts.type, submission_id: opts.submissionId ?? null,
    })
  } catch { /* best-effort */ }
}
