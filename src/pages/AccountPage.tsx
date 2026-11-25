import { useEffect, useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { FREE_TUTOR_REPLIES_TOTAL, PAID_PRICE_USD_PER_MONTH, PAID_TUTOR_REPLIES_PER_DAY } from '../config'
import { useAuth } from '../lib/auth'
import { callFunction, supabase } from '../lib/supabase'

export function AccountPage() {
  const { session, loading, isPaid, subscription, refresh } = useAuth()
  const [params] = useSearchParams()
  const checkout = params.get('checkout')
  const [busy, setBusy] = useState(false)
  const [errorText, setErrorText] = useState('')
  const [repliesUsed, setRepliesUsed] = useState<number | null>(null)
  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    supabase
      .from('usage')
      .select('replies')
      .then(({ data }) => setRepliesUsed((data ?? []).reduce((s, r) => s + r.replies, 0)))
  }, [userId])

  // Stripe's webhook can land a few seconds after the redirect back.
  useEffect(() => {
    if (checkout !== 'success') return
    const timers = [1500, 4000, 8000].map((ms) => setTimeout(refresh, ms))
    return () => timers.forEach(clearTimeout)
  }, [checkout, refresh])

  if (loading) return <p className="page-narrow">Loading…</p>
  if (!session) return <Navigate to="/login" replace />

  const go = async (fn: 'create-checkout' | 'customer-portal') => {
    setBusy(true)
    setErrorText('')
    const res = await callFunction<{ url: string }>(fn)
    if (res.ok) window.location.href = res.data.url
    else {
      setErrorText(res.message)
      setBusy(false)
    }
  }

  return (
    <section className="page-narrow">
      <h1>Your account</h1>
      <p className="small">{session.user.email}</p>

      {checkout === 'success' && !isPaid && <p className="feedback good">Thanks! Activating your plan…</p>}
      {checkout === 'canceled' && <p className="hint">Checkout canceled. No charge was made.</p>}

      <div className="card">
        <h2>{isPaid ? 'Paid plan' : 'Free plan'}</h2>
        {isPaid ? (
          <>
            <p>
              AI tutor with up to {PAID_TUTOR_REPLIES_PER_DAY} replies a day.
              {subscription?.current_period_end &&
                ` Renews ${new Date(subscription.current_period_end).toLocaleDateString()}.`}
            </p>
            <button type="button" className="secondary" disabled={busy} onClick={() => go('customer-portal')}>
              Manage billing
            </button>
          </>
        ) : (
          <>
            <p>
              Learn mode, quizzes, weak-spot tracking, and audio are free. You also get {FREE_TUTOR_REPLIES_TOTAL} AI
              tutor replies to try.
              {repliesUsed !== null && ` You've used ${Math.min(repliesUsed, FREE_TUTOR_REPLIES_TOTAL)}.`}
            </p>
            <p>
              <strong>Upgrade for ${PAID_PRICE_USD_PER_MONTH}/month:</strong> the AI tutor every day (up to{' '}
              {PAID_TUTOR_REPLIES_PER_DAY} replies), with answers drawn from our study notes.
            </p>
            <button type="button" disabled={busy} onClick={() => go('create-checkout')}>
              {busy ? 'Opening checkout…' : 'Upgrade'}
            </button>
          </>
        )}
        {errorText && <p className="error">{errorText}</p>}
      </div>

      <button type="button" className="secondary" onClick={() => supabase.auth.signOut()}>
        Sign out
      </button>
    </section>
  )
}
