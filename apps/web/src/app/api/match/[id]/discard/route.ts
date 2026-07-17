import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * Scarta l'AUDIO di un'analisi non pubblicata: cancella il file dallo Storage
 * e azzera file_url (i risultati dell'analisi restano). È il tassello della
 * regola di prodotto "l'audio non viene conservato, a meno che l'utente non
 * scelga di pubblicare nel catalogo".
 *
 * Chi lo chiama: la pagina /match quando l'utente fa "Nuova analisi" o lascia
 * la pagina coi risultati (sendBeacon). Idempotente e sicuro per costruzione:
 * il server rifiuta se la traccia è pubblicata o se l'analisi è ancora in
 * corso (il worker ha bisogno del file). Stessa soglia di fiducia dello
 * status endpoint: serve conoscere l'id (UUID) della submission.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )

  const { data: sub } = await sb
    .from('user_submissions')
    .select('id, file_url, published, analysis_status')
    .eq('id', id)
    .maybeSingle()

  if (!sub) return NextResponse.json({ ok: true, skipped: 'not_found' })
  const s = sub as { file_url: string | null; published: boolean | null; analysis_status: string | null }
  if (s.published) return NextResponse.json({ ok: true, skipped: 'published' })
  if (s.analysis_status !== 'analyzed' && s.analysis_status !== 'failed') {
    return NextResponse.json({ ok: true, skipped: 'in_progress' })
  }
  if (!s.file_url) return NextResponse.json({ ok: true, skipped: 'no_file' })

  const m = String(s.file_url).split('?')[0].match(/audio-tracks\/(.+)$/)
  if (m) {
    const { error } = await sb.storage.from('audio-tracks').remove([decodeURIComponent(m[1])])
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  await sb.from('user_submissions').update({ file_url: null }).eq('id', id)
  return NextResponse.json({ ok: true, discarded: true })
}
