// Runs eval/questions.json through the deployed tutor with Haiku and Sonnet.
//
// Usage:
//   EVAL_ACCESS_TOKEN=<copied from the Reviewer page> node scripts/eval.ts
//   EVAL_TOPIC=heart EVAL_MCQ_LIMIT=20 ...   # optional: which practice questions to include (default 20, all topics)
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY from .env.local.
// Writes eval/results-<timestamp>.csv with a blank "reviewer_verdict" column to fill in.

import { readFileSync, writeFileSync } from 'node:fs'

type EvalQuestion = { id: number; question: string; expected?: string; expect_not_sure?: boolean; safety?: boolean }
type TutorReply = {
  answer: string
  model: string | null
  citations: { title: string }[]
  usage?: { input: number; output: number; cost: number }
}

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const url = process.env.VITE_SUPABASE_URL ?? env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY
const token = process.env.EVAL_ACCESS_TOKEN
if (!url || !key || !token) {
  console.error('Need VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY (.env.local) and EVAL_ACCESS_TOKEN.')
  process.exit(1)
}

const { questions } = JSON.parse(readFileSync('eval/questions.json', 'utf8')) as { questions: EvalQuestion[] }
const models = ['haiku', 'sonnet'] as const

// Also give the tutor some of the same multiple-choice questions students see.
type McqRow = { id: string; prompt: string; passage: string | null; choices: string[]; answer_index: number }
const topicFilter = process.env.EVAL_TOPIC ? `&topic_id=eq.${encodeURIComponent(process.env.EVAL_TOPIC)}` : ''
const mcqLimit = Number(process.env.EVAL_MCQ_LIMIT ?? 20)
const mcqRes = await fetch(`${url}/rest/v1/questions?kind=eq.mcq${topicFilter}&select=id,prompt,passage,choices,answer_index&order=id&limit=${mcqLimit}`, {
  headers: { apikey: key, Authorization: `Bearer ${key}` },
})
const mcqs = (mcqRes.ok ? await mcqRes.json() : []) as McqRow[]
const LETTERS = 'ABCDEFGH'
const mcqAnswer = new Map<number, { letter: string; text: string }>()
mcqs.forEach((m, i) => {
  const id = 1000 + i
  mcqAnswer.set(id, { letter: LETTERS[m.answer_index], text: m.choices[m.answer_index] })
  questions.push({
    id,
    question: `${m.passage ? `${m.passage}\n\n` : ''}${m.prompt}\n${m.choices.map((c, j) => `${LETTERS[j]}. ${c}`).join('\n')}\nAnswer with the letter and a one-line reason.`,
    expected: `${LETTERS[m.answer_index]}. ${m.choices[m.answer_index]} (draft key, ${m.id})`,
  })
})

function autoGrade(id: number, answer: string) {
  const key = mcqAnswer.get(id)
  if (!key) return ''
  const picked = answer.match(/\b([A-H])[.):]/)?.[1] ?? answer.trim().match(/^([A-H])\b/)?.[1]
  if (picked) return picked === key.letter ? 'match' : 'mismatch'
  return answer.toLowerCase().includes(key.text.toLowerCase()) ? 'match?' : 'unclear'
}

async function ask(question: string, model: (typeof models)[number]) {
  const res = await fetch(`${url}/functions/v1/tutor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key!, Authorization: `Bearer ${token}` },
    body: JSON.stringify({ message: question, forceModel: model }),
  })
  const body = await res.json()
  if (!res.ok) throw new Error(`${res.status} ${body.message ?? JSON.stringify(body)}`)
  return body as TutorReply
}

const csvCell = (v: unknown) => `"${String(v ?? '').replaceAll('"', '""')}"`
const rows: string[] = [
  ['id', 'question', 'expected', 'model', 'answer', 'said_not_sure', 'auto_grade', 'citations', 'input_tokens', 'output_tokens', 'cost_usd', 'reviewer_verdict']
    .map(csvCell)
    .join(','),
]
const totals: Record<string, { cost: number; n: number; notSure: number; notSureCorrect: number; mcqRight: number; errors: number }> = {}

for (const q of questions) {
  for (const model of models) {
    const t = (totals[model] ??= { cost: 0, n: 0, notSure: 0, notSureCorrect: 0, mcqRight: 0, errors: 0 })
    try {
      const r = await ask(q.question, model)
      const notSure = /i'?m not sure/i.test(r.answer)
      t.n++
      t.cost += r.usage?.cost ?? 0
      if (notSure) t.notSure++
      if (q.expect_not_sure && notSure) t.notSureCorrect++
      if (autoGrade(q.id, r.answer) === 'match') t.mcqRight++
      rows.push(
        [
          q.id,
          q.question,
          q.expect_not_sure ? '(should say not sure)' : q.expected,
          r.model ?? 'none (no sources)',
          r.answer,
          notSure,
          autoGrade(q.id, r.answer),
          r.citations.map((c) => c.title).join('; '),
          r.usage?.input ?? 0,
          r.usage?.output ?? 0,
          (r.usage?.cost ?? 0).toFixed(6),
          '',
        ]
          .map(csvCell)
          .join(','),
      )
      console.log(`#${q.id} ${model.padEnd(6)} ${notSure ? '[not sure] ' : ''}${r.answer.replace(/\s+/g, ' ').slice(0, 90)}`)
    } catch (e) {
      t.errors++
      console.error(`#${q.id} ${model} ERROR ${(e as Error).message}`)
    }
  }
}

const expectedNotSure = questions.filter((q) => q.expect_not_sure).length
console.log('\nModel   Answered  Not-sure  Declined-correctly  MCQ-match  Errors  Total cost   Cost/reply')
for (const [model, t] of Object.entries(totals)) {
  console.log(
    `${model.padEnd(8)}${String(t.n).padEnd(10)}${String(t.notSure).padEnd(10)}${`${t.notSureCorrect}/${expectedNotSure}`.padEnd(20)}${`${t.mcqRight}/${mcqs.length}`.padEnd(11)}${String(t.errors).padEnd(8)}$${t.cost.toFixed(4).padEnd(11)}$${(t.n ? t.cost / t.n : 0).toFixed(5)}`,
  )
}

const out = `eval/results-${new Date().toISOString().replace(/[:.]/g, '-')}.csv`
writeFileSync(out, rows.join('\n'))
console.log(`\nWrote ${out}. Have the reviewer fill in "reviewer_verdict" (right / wrong).`)
