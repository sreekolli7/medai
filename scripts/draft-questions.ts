// Batch-drafts more practice questions with Claude Opus, grounded only in the topic's tutor sources.
// Output goes to content/questions/draft-<topic>.json (reviewed = false once loaded). A reviewer must
// approve each question before it shows as Verified.
//
// Usage (the key stays on your machine; it is never sent to the browser):
//   ANTHROPIC_API_KEY=... node scripts/draft-questions.ts <topic-id> [count]
//   node scripts/build-questions-sql.ts && npx supabase db query --linked -f supabase/content/questions.sql

import { readFileSync, writeFileSync } from 'node:fs'

const MODEL = 'claude-opus-5-5'
const MAX_SOURCE_CHUNKS = 30

const topicId = process.argv[2]
const count = Number(process.argv[3] ?? 10)
const apiKey = process.env.ANTHROPIC_API_KEY
if (!topicId || !apiKey) {
  console.error('Usage: ANTHROPIC_API_KEY=... node scripts/draft-questions.ts <topic-id> [count]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_PUBLISHABLE_KEY

type Chunk = { id: number; title: string; body: string; source_name: string; source_url: string | null }
const res = await fetch(
  `${url}/rest/v1/content_chunks?topic_id=eq.${encodeURIComponent(topicId)}&select=id,title,body,source_name,source_url&order=id&limit=${MAX_SOURCE_CHUNKS}`,
  { headers: { apikey: key, Authorization: `Bearer ${key}` } },
)
const chunks = (await res.json()) as Chunk[]
if (!chunks.length) {
  console.error(`No source chunks for topic "${topicId}". Import them first (scripts/import-wikipedia.ts).`)
  process.exit(1)
}

const sources = chunks.map((c, i) => `<source id="S${i + 1}" title="${c.title}">\n${c.body}\n</source>`).join('\n')
const prompt = `Write ${count} MCAT-style multiple-choice practice questions using ONLY facts stated in the sources below.
Rules:
- Every fact in the question, the correct answer and the explanation must be directly supported by one source. If you can't support it, don't write the question.
- 4 choices each, exactly one correct, plausible distractors. Mix recall and reasoning.
- Plain, clear wording. Explanation: 1-2 sentences.
- Reply with JSON only: {"questions":[{"prompt":"","choices":["","","",""],"answer":"A","explanation":"","source":"S1","difficulty":2}]}

SOURCES:
${sources}`

const ai = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
  body: JSON.stringify({ model: MODEL, max_tokens: 8000, messages: [{ role: 'user', content: prompt }] }),
})
if (!ai.ok) {
  console.error(`Anthropic error ${ai.status}: ${await ai.text()}`)
  process.exit(1)
}
const body = await ai.json()
const text = (body.content as { type: string; text?: string }[]).map((b) => b.text ?? '').join('')
const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)) as {
  questions: { prompt: string; choices: string[]; answer: string; explanation: string; source: string; difficulty?: number }[]
}

const questions = parsed.questions.flatMap((q) => {
  const chunk = chunks[Number(q.source?.replace(/\D/g, '')) - 1]
  if (!chunk) return []
  return [
    {
      prompt: q.prompt,
      choices: q.choices,
      answer: q.answer,
      explanation: q.explanation,
      difficulty: q.difficulty ?? 2,
      source_name: `MedAi draft based on ${chunk.source_name}`,
      source_url: chunk.source_url ?? undefined,
    },
  ]
})

const out = `content/questions/draft-${topicId}.json`
writeFileSync(
  out,
  JSON.stringify(
    {
      _note: `AI-drafted by ${MODEL} from the topic's tutor sources on ${new Date().toISOString()}. Needs human review.`,
      source_name: 'MedAi AI-drafted question (draft)',
      license: 'Original MedAi draft based on CC BY-SA 4.0 sources; shared under CC BY-SA 4.0.',
      topics: { [topicId]: questions },
    },
    null,
    2,
  ) + '\n',
)
const usage = body.usage ?? {}
console.log(`Wrote ${out}: ${questions.length} questions (tokens in ${usage.input_tokens}, out ${usage.output_tokens})`)
