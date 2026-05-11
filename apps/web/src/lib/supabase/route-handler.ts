import { createRouteHandlerClient } from '@supabase/nextjs'
import { cookies } from 'next/headers'
import { Database } from './database.types'

export function createClient() {
  const cookieStore = cookies()
  return createRouteHandlerClient<Database>({ cookies: () => cookieStore })
}
