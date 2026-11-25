import type { Question, QuestionSrsRow, SrsRow } from '../types'
import { supabase } from './supabase'

export async function loadSrs(): Promise<SrsRow[]> {
  const { data } = await supabase.from('srs').select('part_id, misses, correct_streak, interval_days, due_at')
  return (data ?? []) as SrsRow[]
}

export async function loadQuestionSrs(): Promise<QuestionSrsRow[]> {
  const { data } = await supabase
    .from('question_srs')
    .select('question_id, misses, correct_streak, interval_days, due_at')
  return (data ?? []) as QuestionSrsRow[]
}

export async function recordAttempt(questionId: string, correct: boolean) {
  const { error } = await supabase.rpc('record_attempt', { p_question_id: questionId, p_correct: correct })
  return !error
}

function shuffle<T>(items: T[]) {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type Schedule = { misses: number; due_at: string }

/** Due items first (most-missed first), then never-seen items, then the rest by due date. */
function orderBySchedule<T>(items: T[], scheduleOf: (item: T) => Schedule | undefined) {
  const now = Date.now()
  const rank = (item: T) => {
    const r = scheduleOf(item)
    if (!r) return { bucket: 1, key: 0 }
    const due = new Date(r.due_at).getTime()
    if (due <= now) return { bucket: 0, key: -r.misses }
    return { bucket: 2, key: due }
  }
  return shuffle(items).sort((a, b) => {
    const ra = rank(a)
    const rb = rank(b)
    return ra.bucket - rb.bucket || ra.key - rb.key
  })
}

/** Tap-the-model questions, scheduled by the part they ask about. */
export function orderQuestions(questions: Question[], srs: SrsRow[]) {
  const byPart = new Map(srs.map((r) => [r.part_id, r]))
  return orderBySchedule(questions, (q) => byPart.get(q.correct_part_id ?? q.part_id ?? ''))
}

/** Multiple-choice questions, scheduled one by one. Passage questions stay in their original order. */
export function orderMcqs(questions: Question[], srs: QuestionSrsRow[]) {
  const byQuestion = new Map(srs.map((r) => [r.question_id, r]))
  const singles = questions.filter((q) => !q.passage)
  const passages = new Map<string, Question[]>()
  for (const q of questions.filter((q) => q.passage)) passages.set(q.passage!, [...(passages.get(q.passage!) ?? []), q])
  const groups = [...singles.map((q) => [q]), ...passages.values()]
  const earliest = (group: Question[]) =>
    group
      .map((q) => byQuestion.get(q.id))
      .filter((r): r is QuestionSrsRow => !!r)
      .sort((a, b) => a.due_at.localeCompare(b.due_at))[0]
  return orderBySchedule(groups, earliest).flat()
}

export const isDue = (r: { due_at: string }) => new Date(r.due_at).getTime() <= Date.now()
