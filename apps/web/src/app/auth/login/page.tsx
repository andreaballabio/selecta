'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { Mail, Loader2, CheckCircle } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [origin, setOrigin] = useState('http://localhost:3001')
  const [email, setEmail] = useState('')
  const [magicState, setMagicState] = useState<'idle' | 'sending' | 'sent'>('idle')

  useEffect(() => {
    setOrigin(window.location.origin)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) { router.push('/dashboard'); router.refresh() }
    })
    return () => subscription.unsubscribe()
  }, [router, supabase])

  const sendMagicLink = async () => {
    if (!email.trim()) return
    setMagicState('sending')
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: `${origin}/auth/callback` } })
    setMagicState(error ? 'idle' : 'sent')
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface/50 p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 font-display text-2xl font-bold text-text">Accedi a Selecta</h1>
          <p className="text-muted">Analizza, pubblica, fatti scoprire</p>
        </div>

        {/* Magic link */}
        {magicState === 'sent' ? (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/[0.06] p-4 text-sm text-text">
            <CheckCircle className="h-5 w-5 shrink-0 text-accent" /> Ti abbiamo inviato un link di accesso. Controlla la mail.
          </div>
        ) : (
          <div className="mb-6">
            <label className="mb-1.5 block text-sm font-medium text-text">Accesso rapido con magic link</label>
            <div className="flex gap-2">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMagicLink()}
                placeholder="la-tua@email.com"
                className="flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5 text-sm text-text placeholder-faint focus:border-accent focus:outline-none"
              />
              <button onClick={sendMagicLink} disabled={magicState === 'sending' || !email.trim()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-semibold text-accent-ink disabled:opacity-50">
                {magicState === 'sending' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Invia
              </button>
            </div>
          </div>
        )}

        <div className="mb-5 flex items-center gap-3 text-xs text-faint">
          <span className="h-px flex-1 bg-line" /> oppure con password <span className="h-px flex-1 bg-line" />
        </div>

        <Auth
          supabaseClient={supabase}
          appearance={{ theme: ThemeSupa }}
          theme="dark"
          providers={[]}
          redirectTo={`${origin}/auth/callback`}
        />
      </div>
    </div>
  )
}
