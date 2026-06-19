import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeLabelScores } from '@/lib/label-scores'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

/** Ricalcola ogni giorno i punteggi A&R di tutte le label. Serve perché le finestre
 *  temporali (uscite negli ultimi 12/18 mesi) "invecchiano" col tempo anche senza
 *  nuovi import. Solo letture sulla coda + update di `labels` → non tocca l'analisi. */
export async function GET(request: NextRequest) {
  const ua = request.headers.get('user-agent') ?? ''
  const auth = request.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  if (!ua.includes('vercel-cron') && !(secret && auth === `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data } = await supabase.from('labels').select('id').gt('cataloged_tracks', 0)
  let ok = 0, skip = 0
  for (const l of data ?? []) {
    try { (await computeLabelScores(supabase, l.id)) ? ok++ : skip++ } catch { skip++ }
  }
  return NextResponse.json({ ok: true, computed: ok, skipped: skip })
}
