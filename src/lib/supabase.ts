import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const supabaseConfigured = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')

export type FunctionResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; message: string; upgrade?: boolean }

export async function callFunction<T>(name: string, body: unknown = {}): Promise<FunctionResult<T>> {
  const { data: session } = await supabase.auth.getSession()
  const token = session.session?.access_token
  try {
    const res = await fetch(`${url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key!,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: json.error ?? 'error',
        message: json.message ?? 'Something went wrong. Try again.',
        upgrade: json.upgrade,
      }
    }
    return { ok: true, data: json as T }
  } catch {
    return { ok: false, status: 0, error: 'network', message: "Couldn't reach the server. Check your connection." }
  }
}
