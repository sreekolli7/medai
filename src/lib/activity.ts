import { useEffect, useState } from 'react'
import { useAuth } from './auth'
import { supabase } from './supabase'

export type TopicStat = { topicId: string; total: number; correct: number }

export type Activity = {
  total: number
  correct: number
  today: number
  streakDays: number
  byTopic: Record<string, TopicStat>
}

type AttemptRow = { correct: boolean; created_at: string; questions: { topic_id: string } | null }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`

/** Consecutive days with at least one answer, ending today (or yesterday, so a streak survives until midnight). */
function streak(days: Set<string>) {
  const d = new Date()
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d.setDate(d.getDate() - 1)
  }
  return n
}

export async function loadActivity(): Promise<Activity> {
  const { data } = await supabase
    .from('attempts')
    .select('correct, created_at, questions(topic_id)')
    .order('created_at', { ascending: false })
    .limit(5000)
  const rows = (data ?? []) as unknown as AttemptRow[]
  const today = dayKey(new Date())
  const days = new Set<string>()
  const byTopic: Record<string, TopicStat> = {}
  let correct = 0
  let todayCount = 0
  for (const r of rows) {
    const key = dayKey(new Date(r.created_at))
    days.add(key)
    if (key === today) todayCount++
    if (r.correct) correct++
    const id = r.questions?.topic_id
    if (!id) continue
    const s = (byTopic[id] ??= { topicId: id, total: 0, correct: 0 })
    s.total++
    if (r.correct) s.correct++
  }
  return { total: rows.length, correct, today: todayCount, streakDays: streak(days), byTopic }
}

/** The signed-in user's activity, or null while loading / signed out. */
export function useActivity() {
  const { session } = useAuth()
  const userId = session?.user.id
  const [activity, setActivity] = useState<Activity | null>(null)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    loadActivity().then((a) => !cancelled && setActivity(a))
    return () => {
      cancelled = true
    }
  }, [userId])

  return userId ? activity : null
}

export const pct = (correct: number, total: number) => (total ? Math.round((correct / total) * 100) : 0)
