'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()
  const [origin, setOrigin] = useState('http://localhost:3001')

  useEffect(() => {
    // window è disponibile solo nel browser
    setOrigin(window.location.origin)
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        router.push('/dashboard')
        router.refresh()
      }
    })

    return () => subscription.unsubscribe()
  }, [router, supabase])

  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-950/50 p-8">
        <div className="mb-8 text-center">
          <h1 className="mb-2 text-2xl font-bold text-white">Accedi a Selecta</h1>
          <p className="text-zinc-400">Analizza le tue tracce con AI</p>
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
