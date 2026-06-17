import { createClient } from '@supabase/supabase-js'

/**
 * Client Supabase con SERVICE ROLE — SOLO lato server. Bypassa la RLS.
 * Usato per le letture pubbliche aggregate/curate (press kit, catalogo) senza
 * dover esporre righe protette tramite la anon key.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY)!,
  )
}
