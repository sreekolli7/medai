import { useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { SECTION_COLORS } from '../config'
import { loadActivity, pct, type Activity } from '../lib/activity'
import { useAuth } from '../lib/auth'
import { useCatalog } from '../lib/catalog'
import { useContent } from '../lib/content'
import { isDue, loadQuestionSrs, loadSrs } from '../lib/srs'
import type { SrsRow } from '../types'

function dueLabel(dueAt: string) {
  const ms = new Date(dueAt).getTime() - Date.now()
  if (ms <= 0) return 'due now'
  const hours = ms / 3_600_000
  if (hours < 1) return `due in ${Math.ceil(ms / 60_000)} min`
  if (hours < 24) return `due in ${Math.round(hours)} h`
  return `due in ${Math.round(hours / 24)} days`
}

export function ProgressMode() {
  const { session } = useAuth()
  const { partById } = useContent()
  const { topicById } = useCatalog()
  const [partSrs, setPartSrs] = useState<SrsRow[] | null>(null)
  const [dueQuestions, setDueQuestions] = useState(0)
  const [activity, setActivity] = useState<Activity | null>(null)

  const userId = session?.user.id

  useEffect(() => {
    if (!userId) return
    ;(async () => {
      const [parts, questions, a] = await Promise.all([loadSrs(), loadQuestionSrs(), loadActivity()])
      setPartSrs(parts)
      setDueQuestions(questions.filter(isDue).length)
      setActivity(a)
    })()
  }, [userId])

  if (!session) {
    return (
      <section className="panel full summary">
        <div className="big-emoji" aria-hidden="true" style={{ fontSize: '3rem' }}>
          🎯
        </div>
        <h2>Track your weak spots</h2>
        <p className="hint">
          Sign in and answer some questions. We'll show your weakest topics, keep your streak, and tell you when to review.
        </p>
        <Link to="/login" className="button big">
          Sign in free
        </Link>
      </section>
    )
  }

  if (!partSrs || !activity) return <section className="panel full">Loading…</section>

  const dueParts = partSrs.filter(isDue).length
  const weakParts = [...partSrs].filter((r) => r.misses > 0).sort((a, b) => b.misses - a.misses)
  const byTopic = Object.values(activity.byTopic).sort(
    (a, b) => a.correct / a.total - b.correct / b.total || b.total - a.total,
  )

  return (
    <section className="panel full">
      <div className="stats">
        <div>
          <strong>{activity.total}</strong>
          <span>answers</span>
        </div>
        <div>
          <strong>{pct(activity.correct, activity.total)}%</strong>
          <span>correct</span>
        </div>
        <div>
          <strong>{activity.streakDays ? `🔥 ${activity.streakDays}` : '0'}</strong>
          <span>day streak</span>
        </div>
        <div>
          <strong>{dueQuestions + dueParts}</strong>
          <span>due for review</span>
        </div>
      </div>

      <div className="row">
        {dueQuestions > 0 && (
          <Link to="/practice/review" className="button">
            Review {dueQuestions} due question{dueQuestions === 1 ? '' : 's'}
          </Link>
        )}
        {dueParts > 0 && (
          <Link to="/anatomy/heart/quiz" className="button secondary">
            Review {dueParts} heart part{dueParts === 1 ? '' : 's'}
          </Link>
        )}
      </div>

      <h2>By topic · weakest first</h2>
      {byTopic.length === 0 ? (
        <p className="hint">
          No answers yet. <Link to="/practice/warmup">Try a quick warm-up</Link> and your weakest topics will show up here.
        </p>
      ) : (
        <div className="topic-list">
          {byTopic.map((s) => {
            const topic = topicById(s.topicId)
            const p = pct(s.correct, s.total)
            return (
              <Link
                key={s.topicId}
                to={topic ? `/practice/${topic.section_id}/${topic.id}` : '/practice'}
                className="topic-row"
                style={{ '--c': topic ? SECTION_COLORS[topic.section_id] : undefined } as CSSProperties}
              >
                <span>
                  <span className="choice-title">{topic?.name ?? s.topicId}</span>
                </span>
                <span className="count">{p < 60 ? 'Practice this →' : p < 85 ? 'Getting there' : 'Strong 💪'}</span>
                <span className="topic-progress">
                  <span className="meter" aria-hidden="true">
                    <span style={{ width: `${p}%` }} />
                  </span>
                  {p}% right · {s.total} answer{s.total === 1 ? '' : 's'}
                </span>
              </Link>
            )
          })}
        </div>
      )}

      {weakParts.length > 0 && (
        <>
          <h2>Heart parts you miss</h2>
          <table className="weak">
            <thead>
              <tr>
                <th>Part</th>
                <th>Misses</th>
                <th>Next review</th>
              </tr>
            </thead>
            <tbody>
              {weakParts.map((r) => (
                <tr key={r.part_id}>
                  <td>
                    <Link to={`/anatomy/heart/learn?part=${r.part_id}`}>{partById(r.part_id)?.name ?? r.part_id}</Link>
                  </td>
                  <td>{r.misses}</td>
                  <td>{dueLabel(r.due_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}
