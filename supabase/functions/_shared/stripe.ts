import Stripe from 'npm:stripe@17'

export function stripeClient() {
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return null
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() })
}

export function siteUrl(req: Request) {
  return Deno.env.get('SITE_URL') ?? req.headers.get('origin') ?? 'http://localhost:5173'
}
