import { NextResponse } from 'next/server'
import { redirect } from 'next/navigation'
import { createClient as createSsrClient } from '@/lib/supabase/server'
import { isAdminEmail } from '@/lib/admin'

/**
 * Gate per le ROUTE HANDLER admin (`/api/admin/*`).
 * Ritorna `null` se l'utente loggato è admin, altrimenti la NextResponse
 * (401 se non loggato, 403 se loggato ma non admin) da restituire subito.
 *
 * Uso, come prima riga del handler:
 *   const denied = await requireAdminApi(); if (denied) return denied
 *
 * NB: le route admin usano la SERVICE ROLE (bypassa la RLS), quindi questo
 * controllo è l'UNICA barriera — va messo prima di qualsiasi accesso al DB.
 */
export async function requireAdminApi(): Promise<NextResponse | null> {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  if (!isAdminEmail(user.email)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  return null
}

/**
 * Gate per le PAGINE/LAYOUT admin (server component).
 * Reindirizza alla home se l'utente non è admin. Va chiamato in cima a un
 * componente server (es. il layout di /admin), così copre tutte le sottopagine.
 */
export async function requireAdminPage(): Promise<void> {
  const ssr = await createSsrClient()
  const { data: { user } } = await ssr.auth.getUser()
  if (!isAdminEmail(user?.email)) redirect('/')
}
