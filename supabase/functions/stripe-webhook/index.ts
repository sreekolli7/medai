import Stripe from 'npm:stripe@17'
import { json } from '../_shared/http.ts'
import { stripeClient } from '../_shared/stripe.ts'
import { admin } from '../_shared/supabase.ts'

const KNOWN_STATUSES = new Set(['active', 'trialing', 'canceled', 'past_due', 'incomplete', 'unpaid'])

function periodEnd(sub: Stripe.Subscription) {
  // Newer Stripe API versions moved current_period_end onto subscription items.
  const raw =
    (sub as unknown as { current_period_end?: number }).current_period_end ??
    (sub.items?.data?.[0] as unknown as { current_period_end?: number } | undefined)?.current_period_end
  return raw ? new Date(raw * 1000).toISOString() : null
}

async function saveSubscription(sub: Stripe.Subscription, userIdHint?: string | null) {
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id
  let userId = userIdHint ?? sub.metadata?.user_id ?? null
  if (!userId) {
    const { data } = await admin
      .from('subscriptions')
      .select('user_id')
      .eq('stripe_customer_id', customerId)
      .maybeSingle()
    userId = data?.user_id ?? null
  }
  if (!userId) {
    console.error('webhook: could not match subscription to a user', sub.id)
    return
  }

  const status = KNOWN_STATUSES.has(sub.status) ? sub.status : 'canceled'
  const { error } = await admin.from('subscriptions').upsert({
    user_id: userId,
    status,
    plan: 'paid',
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    current_period_end: periodEnd(sub),
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}

Deno.serve(async (req) => {
  const stripe = stripeClient()
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!stripe || !secret) return json({ error: 'not_configured' }, 503)

  const signature = req.headers.get('stripe-signature')
  if (!signature) return json({ error: 'missing_signature' }, 400)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(
      await req.text(),
      signature,
      secret,
      undefined,
      Stripe.createSubtleCryptoProvider(),
    )
  } catch (e) {
    console.error('webhook signature failed', e)
    return json({ error: 'bad_signature' }, 400)
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode === 'subscription' && session.subscription) {
          const subId =
            typeof session.subscription === 'string' ? session.subscription : session.subscription.id
          const sub = await stripe.subscriptions.retrieve(subId)
          await saveSubscription(sub, session.client_reference_id)
        }
        break
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await saveSubscription(event.data.object)
        break
    }
  } catch (e) {
    console.error('webhook handling failed', e)
    return json({ error: 'handler_failed' }, 500)
  }

  return json({ received: true })
})
