'use client'

import { useState } from 'react'
import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export default function LoginButtons() {
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    setIsLoading(true)
    const supabase = createSupabaseBrowserClient()

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      console.error('OAuth error:', error.message)
      setIsLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="btn btn-primary"
    >
      {isLoading ? 'Redirecting...' : 'Continue with Google'}
    </button>
  )
}
