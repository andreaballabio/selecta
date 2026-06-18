import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAdminEmail } from '@/lib/admin'

/**
 * Rinfresca la sessione Supabase lato server (token refresh) e PROTEGGE l'area
 * admin: /admin e /api/admin sono accessibili solo agli account nell'allowlist.
 * In questo fork di Next il file-convention "middleware" è "proxy" (runtime Node).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    },
  )

  let email: string | null = null
  try {
    const { data: { user } } = await supabase.auth.getUser()
    email = user?.email ?? null
  } catch { /* auth non raggiungibile */ }

  // Guardia area admin
  const path = request.nextUrl.pathname
  if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
    if (!isAdminEmail(email)) {
      if (path.startsWith('/api/')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      const url = request.nextUrl.clone()
      url.pathname = email ? '/dashboard' : '/auth/login'
      return NextResponse.redirect(url)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
