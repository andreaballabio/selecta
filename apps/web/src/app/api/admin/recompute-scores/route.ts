import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { computeLabelScores } from '@/lib/label-scores'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! || process.env.SUPABASE_SERVICE_KEY!,
)

/** Ricalcola i punteggi A&R (reachability/openness/cadenza/artisti/ultima uscita)
 *  dai dati del catalogo. Una label sola con { label_id }, oppure tutte. */
export async function POST(request: NextRequest) {
  let labelId: string | undefined
  try { labelId = (await request.json())?.label_id } catch { /* tutte */ }

  const ids: string[] = []
  if (labelId) {
    ids.push(labelId)
  } else {
    const { data } = await supabase.from('labels').select('id')
    for (const l of data ?? []) ids.push(l.id)
  }

  let ok = 0, skipped = 0
  for (const id of ids) {
    try {
      const r = await computeLabelScores(supabase, id)
      r ? ok++ : skipped++
    } catch {
      skipped++
    }
  }
  return NextResponse.json({ ok: true, computed: ok, skipped, total: ids.length })
}
