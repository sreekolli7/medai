import { createClient, type User } from 'npm:@supabase/supabase-js@2'

function serviceKey() {
  const legacy = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (legacy) return legacy
  const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') ?? '{}') as Record<string, string>
  const first = Object.values(keys)[0]
  if (!first) throw new Error('No Supabase service key available')
  return first
}

export const admin = createClient(Deno.env.get('SUPABASE_URL')!, serviceKey(), {
  auth: { persistSession: false, autoRefreshToken: false },
})

export async function getUser(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await admin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function isAdmin(userId: string) {
  const { data } = await admin.from('admins').select('user_id').eq('user_id', userId).maybeSingle()
  return !!data
}

export async function isPaid(userId: string) {
  const { data } = await admin
    .from('subscriptions')
    .select('status, current_period_end')
    .eq('user_id', userId)
    .maybeSingle()
  if (!data) return false
  const activeStatus = data.status === 'active' || data.status === 'trialing'
  const notExpired = !data.current_period_end || new Date(data.current_period_end) > new Date()
  return activeStatus && notExpired
}
