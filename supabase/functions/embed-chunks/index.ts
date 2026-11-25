import { corsHeaders, json } from '../_shared/http.ts'
import { admin, getUser, isAdmin } from '../_shared/supabase.ts'
import { embed } from '../_shared/voyage.ts'

const BATCH = 64

// Admin-only: fills in embeddings for any content_chunks that don't have one yet.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const user = await getUser(req)
  if (!user || !(await isAdmin(user.id))) return json({ error: 'forbidden' }, 403)

  const { data: rows, error } = await admin
    .from('content_chunks')
    .select('id, title, body')
    .is('embedding', null)
    .limit(BATCH)
  if (error) return json({ error: error.message }, 500)
  if (!rows?.length) return json({ embedded: 0, remaining: 0 })

  try {
    const vectors = await embed(rows.map((r) => `${r.title}\n${r.body}`), 'document')
    for (let i = 0; i < rows.length; i++) {
      const { error: upErr } = await admin
        .from('content_chunks')
        .update({ embedding: JSON.stringify(vectors[i]) })
        .eq('id', rows[i].id)
      if (upErr) throw upErr
    }
  } catch (e) {
    console.error('embed failed', e)
    return json({ error: 'embed_failed', message: String(e) }, 500)
  }

  const { count } = await admin
    .from('content_chunks')
    .select('id', { count: 'exact', head: true })
    .is('embedding', null)
  return json({ embedded: rows.length, remaining: count ?? 0 })
})
