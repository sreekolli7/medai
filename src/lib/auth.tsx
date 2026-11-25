import type { Session } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from './supabase'

type Subscription = { status: string; current_period_end: string | null } | null

type AuthState = {
  session: Session | null
  loading: boolean
  isAdmin: boolean
  subscription: Subscription
  isPaid: boolean
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [subscription, setSubscription] = useState<Subscription>(null)

  const loadExtras = useCallback(async (s: Session | null) => {
    if (!s) {
      setIsAdmin(false)
      setSubscription(null)
      return
    }
    const [{ data: admin }, { data: sub }] = await Promise.all([
      supabase.rpc('is_admin'),
      supabase.from('subscriptions').select('status, current_period_end').maybeSingle(),
    ])
    setIsAdmin(Boolean(admin))
    setSubscription(sub)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session)
      await loadExtras(data.session)
      setLoading(false)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      // Defer so we don't call Supabase inside the auth callback.
      setTimeout(() => loadExtras(s), 0)
    })
    return () => listener.subscription.unsubscribe()
  }, [loadExtras])

  const isPaid =
    !!subscription &&
    (subscription.status === 'active' || subscription.status === 'trialing') &&
    (!subscription.current_period_end || new Date(subscription.current_period_end) > new Date())

  const refresh = useCallback(() => loadExtras(session), [loadExtras, session])

  return (
    <AuthContext.Provider value={{ session, loading, isAdmin, subscription, isPaid, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
