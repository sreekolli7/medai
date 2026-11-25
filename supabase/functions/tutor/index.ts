import {
  ANTHROPIC_TIMEOUT_MS,
  EXAM,
  FREE_TUTOR_REPLIES_TOTAL,
  IP_REQUESTS_PER_MINUTE,
  MAX_TOKENS,
  MODELS,
  type ModelKey,
  PAID_TUTOR_REPLIES_PER_DAY,
  REQUIRE_REVIEWED_SOURCES,
  SPEND_ALERT_USD_PER_DAY,
  estimateCost,
} from '../_shared/config.ts'
import { clientIp, corsHeaders, json, rateLimited } from '../_shared/http.ts'
import { pickModel } from '../_shared/routing.ts'
import { admin, getUser, isAdmin, isPaid } from '../_shared/supabase.ts'
import { embed } from '../_shared/voyage.ts'

const NOT_SURE = "I'm not sure about that one. Check your textbook."
const MAX_MESSAGE_CHARS = 2000
const HISTORY_TURNS = 6
const TOP_K = 5

const SYSTEM_PROMPT = `You are a study tutor for students preparing for the ${EXAM}. Answer ONLY using the SOURCES provided. If the sources don't contain the answer, say "${NOT_SURE}" and stop. Don't guess. Keep answers short and clear (under 150 words unless asked for more). End with one line starting "Exam tip:" if the sources support it. After the answer, on its own final line, write "Sources:" followed by the source ids you used, comma-separated (for example "Sources: S1, S3"), or "Sources: none". You are not giving medical advice for real patients; if someone describes a real health problem, tell them to see a doctor.`

type Turn = { role: 'user' | 'assistant'; content: string }
type Chunk = {
  id: number
  title: string
  body: string
  source_name: string
  source_url: string | null
  reviewed: boolean
  similarity: number
}

const todayUtc = () => new Date().toISOString().slice(0, 10)

async function repliesUsed(userId: string, paid: boolean) {
  let q = admin.from('usage').select('replies').eq('user_id', userId)
  if (paid) q = q.eq('day', todayUtc())
  const { data } = await q
  return (data ?? []).reduce((sum, r) => sum + (r.replies as number), 0)
}

async function checkSpendAlarm() {
  const { data } = await admin.from('usage').select('cost_usd').eq('day', todayUtc())
  const total = (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd), 0)
  if (total > SPEND_ALERT_USD_PER_DAY) {
    console.warn(`SPEND ALERT: $${total.toFixed(2)} today (threshold $${SPEND_ALERT_USD_PER_DAY})`)
    await admin
      .from('spend_alerts')
      .upsert(
        { day: todayUtc(), total_usd: total, threshold_usd: SPEND_ALERT_USD_PER_DAY },
        { onConflict: 'day', ignoreDuplicates: true },
      )
  }
}

function parseSources(text: string, chunkCount: number) {
  const match = text.match(/\n?\s*Sources:\s*(.*)\s*$/i)
  if (!match) return { answer: text.trim(), used: null as number[] | null }
  const used = [
    ...new Set(
      [...match[1].matchAll(/S(\d+)/gi)]
        .map((m) => Number(m[1]) - 1)
        .filter((i) => i >= 0 && i < chunkCount),
    ),
  ]
  return { answer: text.slice(0, match.index).trim(), used }
}

async function callClaude(model: ModelKey, system: string, messages: Turn[]) {
  const key = Deno.env.get('ANTHROPIC_API_KEY')
  if (!key) throw new Error('ANTHROPIC_API_KEY is not set')
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model: MODELS[model], max_tokens: MAX_TOKENS[model], system, messages }),
    signal: AbortSignal.timeout(ANTHROPIC_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${await res.text()}`)
  const body = await res.json()
  const text = (body.content as { type: string; text?: string }[])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return {
    text,
    inputTokens: body.usage?.input_tokens ?? 0,
    outputTokens: body.usage?.output_tokens ?? 0,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  if (rateLimited(clientIp(req), IP_REQUESTS_PER_MINUTE)) {
    return json({ error: 'rate_limited', message: 'Slow down a little and try again in a minute.' }, 429)
  }

  // 1. Who is asking?
  const user = await getUser(req)
  if (!user) return json({ error: 'unauthorized', message: 'Please sign in to use the tutor.' }, 401)

  let body: { message?: string; history?: Turn[]; explainBetter?: boolean; forceModel?: ModelKey }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'bad_request', message: 'Invalid JSON.' }, 400)
  }
  const message = (body.message ?? '').trim()
  if (!message) return json({ error: 'bad_request', message: 'Ask a question first.' }, 400)
  if (message.length > MAX_MESSAGE_CHARS) {
    return json({ error: 'bad_request', message: 'That question is too long. Try a shorter one.' }, 400)
  }

  // 2 + 3. Subscription and limits, checked on the server.
  const [adminUser, paid] = await Promise.all([isAdmin(user.id), isPaid(user.id)])
  const limit = paid ? PAID_TUTOR_REPLIES_PER_DAY : FREE_TUTOR_REPLIES_TOTAL
  const used = await repliesUsed(user.id, paid)
  if (!adminUser && used >= limit) {
    return json(
      {
        error: 'limit_reached',
        upgrade: !paid,
        message: paid
          ? `You've used all ${limit} tutor replies for today. They reset at midnight UTC.`
          : `You've used your ${limit} free tutor replies. Upgrade to keep asking questions.`,
      },
      402,
    )
  }

  try {
    // 4. Retrieve vetted content.
    const [queryEmbedding] = await embed([message], 'query')
    const { data: chunkRows, error: matchError } = await admin.rpc('match_chunks', {
      query_embedding: JSON.stringify(queryEmbedding),
      match_count: TOP_K,
      only_reviewed: REQUIRE_REVIEWED_SOURCES,
    })
    if (matchError) throw matchError
    const chunks = (chunkRows ?? []) as Chunk[]

    if (chunks.length === 0) {
      return json({ answer: NOT_SURE, model: null, citations: [], remaining: limit - used })
    }

    // 5. Route.
    const model: ModelKey =
      adminUser && body.forceModel && body.forceModel in MODELS
        ? body.forceModel
        : pickModel(message, body.explainBetter)

    // 6. Ask Claude.
    const sources = chunks
      .map((c, i) => `<source id="S${i + 1}" title="${c.title}">\n${c.body}\n</source>`)
      .join('\n')
    const history = (body.history ?? [])
      .filter((t) => (t.role === 'user' || t.role === 'assistant') && typeof t.content === 'string')
      .slice(-HISTORY_TURNS)
      .map((t) => ({ role: t.role, content: t.content.slice(0, MAX_MESSAGE_CHARS) }))
    while (history.length && history[0].role !== 'user') history.shift()

    const userTurn = body.explainBetter
      ? `${message}\n\n(Please explain this more clearly and step by step.)`
      : message
    const result = await callClaude(model, `${SYSTEM_PROMPT}\n\nSOURCES:\n${sources}`, [
      ...history,
      { role: 'user', content: userTurn },
    ])

    // 7. Log usage + spend.
    const cost = estimateCost(MODELS[model], result.inputTokens, result.outputTokens)
    await admin.rpc('log_usage', {
      p_user_id: user.id,
      p_model: MODELS[model],
      p_input: result.inputTokens,
      p_output: result.outputTokens,
      p_cost: cost,
    })
    checkSpendAlarm().catch((e) => console.error('spend alarm failed', e))

    // 8. Answer + citations.
    const { answer, used: usedIdx } = parseSources(result.text, chunks.length)
    const cited = usedIdx === null ? chunks : usedIdx.map((i) => chunks[i])
    const citations = cited.map((c) => ({
      id: c.id,
      title: c.title,
      source_name: c.source_name,
      source_url: c.source_url,
      reviewed: c.reviewed,
    }))

    return json({
      answer,
      model: MODELS[model],
      citations,
      remaining: adminUser ? null : limit - used - 1,
      ...(adminUser ? { usage: { input: result.inputTokens, output: result.outputTokens, cost } } : {}),
    })
  } catch (e) {
    console.error('tutor failed', e)
    return json({ error: 'tutor_failed', message: 'The tutor hit a snag. Try again in a moment.' }, 500)
  }
})
