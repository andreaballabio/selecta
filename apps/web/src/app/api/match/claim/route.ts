import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createSsrClient } from '@/lib/supabase/server'

/**
 * Collega all'utente loggato le analisi fatte da anonimo (user_id null).
 * Il client invia gli id delle submission salvati nel suo localStorage; qui
 * verifichiamo l'utente (sessione) e, con la service role, assegniamo l'owner
 * SOLO alle submission ancora senza proprietario (`user_id is null`) → non si
 * possono "rubare" analisi già di un altro account.
 */
export async function POST(request: NextRequest) {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  let ids: unknown
  try {
    ;({ ids } = await request.json())
  } catch {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const cleanIds = Array.isArray(ids)
    ? ids.filter((v): v is string => typeof v === 'string').slice(0, 50)
    : []
  if (cleanIds.length === 0) {
    return NextResponse.json({ claimed: 0 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )

  const { data, error } = await supabase
    .from('user_submissions')
    .update({ user_id: user.id })
    .in('id', cleanIds)
    .is('user_id', null)
    .select('id')

  if (error) {
    console.error('[match/claim] update error:', error)
    return NextResponse.json({ error: 'Failed to claim' }, { status: 500 })
  }

  return NextResponse.json({ claimed: data?.length ?? 0 })
}
