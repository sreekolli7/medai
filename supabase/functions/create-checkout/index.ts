import { corsHeaders, json } from '../_shared/http.ts'
import { siteUrl, stripeClient } from '../_shared/stripe.ts'
import { admin, getUser } from '../_shared/supabase.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized', message: 'Please sign in first.' }, 401)

  const stripe = stripeClient()
  const priceId = Deno.env.get('STRIPE_PRICE_ID')
  if (!stripe || !priceId) {
    return json({ error: 'not_configured', message: "Payments aren't set up yet." }, 503)
  }

  const { data: sub } = await admin
    .from('subscriptions')
    .select('stripe_customer_id')
    .eq('user_id', user.id)
    .maybeSingle()

  const site = siteUrl(req)
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    client_reference_id: user.id,
    ...(sub?.stripe_customer_id
      ? { customer: sub.stripe_customer_id }
      : { customer_email: user.email }),
    subscription_data: { metadata: { user_id: user.id } },
    success_url: `${site}/account?checkout=success`,
    cancel_url: `${site}/account?checkout=canceled`,
  })

  return json({ url: session.url })
})
