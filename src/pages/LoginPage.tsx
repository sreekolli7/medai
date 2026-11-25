import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'

export function LoginPage() {
  const { session } = useAuth()
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [errorText, setErrorText] = useState('')

  if (session) return <Navigate to="/" replace />

  const sendLink = async (e: FormEvent) => {
    e.preventDefault()
    setState('sending')
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    })
    if (error) {
      setErrorText(error.message)
      setState('error')
    } else setState('sent')
  }

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setErrorText(error.message)
      setState('error')
    }
  }

  return (
    <section className="page-narrow">
      <h1>Sign in</h1>
      <p>Save your quiz misses, get review reminders, and try the AI tutor.</p>

      {state === 'sent' ? (
        <p className="feedback good">Check your email for a sign-in link. You can close this tab.</p>
      ) : (
        <>
          <form onSubmit={sendLink} className="stack">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
            <button type="submit" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
            </button>
          </form>
          <div className="divider">or</div>
          <button type="button" className="secondary wide" onClick={google}>
            Continue with Google
          </button>
        </>
      )}
      {state === 'error' && <p className="error">{errorText || 'Something went wrong. Try again.'}</p>}
    </section>
  )
}
