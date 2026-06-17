import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Rinfresca la sessione Supabase lato server (token refresh) a ogni richiesta,
 * così le route server (es. user-linking in /api/match) e i Server Component
 * leggono uno stato di autenticazione affidabile.
 *
 * In questo fork di Next il file-convention "middleware" è stato rinominato in
 * "proxy" (gira sul runtime Node). Pattern ufficiale @supabase/ssr.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANTE: nessuna logica tra createServerClient e getUser — questa chiamata
  // rinfresca il token e riscrive i cookie di sessione sulla response.
  try {
    await supabase.auth.getUser()
  } catch {
    // Auth non raggiungibile: lascia passare la richiesta invariata.
  }

  return response
}

export const config = {
  matcher: [
    // Tutte le route tranne asset statici, immagini e file con estensione immagine.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
