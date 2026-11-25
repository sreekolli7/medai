import { corsHeaders, json } from '../_shared/http.ts'
import { siteUrl, stripeClient } from '../_shared/stripe.ts'
import { admin, getUser } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized', message: 'Please sign in first.' }, 401)

  const stripe = stripeClient()
  if (!stripe) return json({ error: 'not_configured', message: "Payments aren't set up yet." }, 503)

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (!sub?.stripe_customer_id) {
    return json({ error: 'no_subscription', message: "You don't have a subscription yet." }, 404)
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${siteUrl(req)}/account`,
  })
  return json({ url: session.url })
})
