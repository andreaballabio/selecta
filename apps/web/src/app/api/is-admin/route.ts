import { NextResponse } from 'next/server'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

/** Dice al client se l'utente loggato è admin (per mostrare il pulsante Admin). */
export async function GET() {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  return NextResponse.json({ admin: isAdminEmail(user?.email) })
}
