import { useCallback, useEffect, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { RelatedAnatomy } from '../components/RelatedAnatomy'
import { ReportButton } from '../components/ReportButton'
import { ReviewBadge } from '../components/ReviewBadge'
import { ROUND_SIZE } from '../config'
import { useAuth } from '../lib/auth'
import { useCatalog } from '../lib/catalog'
import { usePrefs } from '../lib/prefs'
import { speak, stopSpeaking } from '../lib/speech'
import { isDue, loadQuestionSrs, orderMcqs, recordAttempt } from '../lib/srs'
import { supabase } from '../lib/supabase'
import type { Question, QuestionSrsRow } from '../types'

const LETTERS = 'ABCDEFGH'
const COLUMNS =
  'id, topic_id, kind, passage, part_id, prompt, correct_part_id, related_part_id, choices, answer_index, answer_explanation, difficulty, reviewed, source_name, source_url, license'
const PRAISE = ['Correct!', 'Nice!', 'You got it!', 'Great job!', 'Spot on!']
const CHEERS = ['🎉', '✨', '🌟', '💪', '🙌']

const spoken = (q: Question) => `${q.prompt} ${(q.choices ?? []).map((c, i) => `${LETTERS[i]}: ${c}.`).join(' ')}`
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)]

/** Next round: up to `size` questions, never splitting a reading passage across rounds. */
function buildRound(pool: Question[], srs: QuestionSrsRow[], size: number) {
  const ordered = orderMcqs(pool, srs)
  const round: Question[] = []
  for (const q of ordered) {
    if (round.length >= size && q.passage !== round.at(-1)?.passage) break
    if (round.length >= size && !q.passage) break
    round.push(q)
  }
  return round
}

type Result = { question: Question; picked: number; correct: boolean }

/** Multiple-choice practice in short rounds. With onlyDue, just the questions due for review. */
export function McqQuiz({
  topicIds,
  onlyDue = false,
  roundSize = ROUND_SIZE,
  backTo = '/practice',
}: {
  topicIds: string[]
  onlyDue?: boolean
  roundSize?: number
  backTo?: string
}) {
  const { session } = useAuth()
  const userId = session?.user.id
  const { voiceOn } = usePrefs()
  const { topicById } = useCatalog()
  const [pool, setPool] = useState<Question[] | null>(null)
  const [round, setRound] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<Result[]>([])
  const [feedbackTitle, setFeedbackTitle] = useState('')
  const [cheer, setCheer] = useState<{ emoji: string; key: number } | null>(null)
  const [finished, setFinished] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const topicKey = topicIds.join(',')

  const startRound = useCallback(
    async (rows: Question[]) => {
      const srs = userId ? await loadQuestionSrs() : []
      const eligible = onlyDue ? rows.filter((q) => srs.some((r) => r.question_id === q.id && isDue(r))) : rows
      setRound(buildRound(eligible, srs, roundSize))
      setIndex(0)
      setResults([])
      setFinished(false)
    },
    [userId, onlyDue, roundSize],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      let query = supabase.from('questions').select(COLUMNS).eq('kind', 'mcq').order('id')
      if (topicKey) query = query.in('topic_id', topicKey.split(','))
      const { data } = await query
      if (cancelled) return
      const rows = (data ?? []) as Question[]
      setPool(rows)
      await startRound(rows)
    })()
    return () => {
      cancelled = true
    }
  }, [topicKey, startRound])

  const question = finished ? undefined : round[index]
  const result = results[index]
  const answered = !!result

  useEffect(() => {
    if (question && voiceOn) speak(spoken(question))
    return () => stopSpeaking()
  }, [question, voiceOn])

  const submit = useCallback(
    async (i: number) => {
      if (!question || answered || i >= (question.choices?.length ?? 0)) return
      const ok = i === question.answer_index
      setResults((r) => [...r, { question, picked: i, correct: ok }])
      setFeedbackTitle(ok ? pick(PRAISE) : 'Not quite')
      if (ok) setCheer({ emoji: pick(CHEERS), key: Date.now() })
      if (voiceOn) {
        speak(ok ? 'Correct.' : `Not quite. The answer is ${LETTERS[question.answer_index!]}, ${question.choices![question.answer_index!]}.`)
      }
      if (userId) setSaveFailed(!(await recordAttempt(question.id, ok)))
    },
    [question, answered, voiceOn, userId],
  )

  const next = useCallback(() => {
    if (!answered) return
    stopSpeaking()
    if (index + 1 < round.length) setIndex(index + 1)
    else setFinished(true)
  }, [answered, index, round.length])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (e.metaKey || e.ctrlKey || e.altKey || target.closest('input, textarea, select')) return
      const key = e.key.toUpperCase()
      const letter = LETTERS.indexOf(key)
      const digit = Number(e.key) - 1
      if (!answered && letter >= 0 && letter < 8) submit(letter)
      else if (!answered && digit >= 0 && digit < 8) submit(digit)
      else if (answered && e.key === 'Enter' && target.tagName !== 'BUTTON') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [answered, submit, next])

  if (!pool) return <section className="panel quiz">Loading questions…</section>

  if (finished) {
    const right = results.filter((r) => r.correct).length
    const score = Math.round((right / results.length) * 100)
    let best = 0
    let run = 0
    for (const r of results) {
      run = r.correct ? run + 1 : 0
      best = Math.max(best, run)
    }
    const missed = results.filter((r) => !r.correct)
    return (
      <section className="panel quiz summary" aria-live="polite">
        <div className="ring big" style={{ '--p': score, '--c': score >= 50 ? 'var(--ok)' : 'var(--accent)' } as CSSProperties}>
          {score}%
        </div>
        <h2>{score >= 80 ? 'Excellent work! 🎉' : score >= 50 ? 'Good round! 💪' : 'Good start! 🌱'}</h2>
        <p className="hint">
          {missed.length
            ? `You missed ${missed.length}. ${userId ? "They'll come back for review soon, right before you'd forget them." : 'Sign in and they’ll come back for review.'}`
            : 'A perfect round. Try another topic or a harder mix.'}
        </p>
        <div className="summary-stats">
          <div>
            <strong>
              {right}/{results.length}
            </strong>
            <span>correct</span>
          </div>
          <div>
            <strong>🔥 {best}</strong>
            <span>best streak</span>
          </div>
        </div>
        {missed.length > 0 && (
          <ul className="missed-list">
            {missed.map((m) => (
              <li key={m.question.id}>
                {m.question.prompt}
                <div className="answer-line">
                  ✓ {LETTERS[m.question.answer_index!]}. {m.question.choices![m.question.answer_index!]}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div className="row">
          <button type="button" className="big" onClick={() => startRound(pool)}>
            Next round →
          </button>
          <Link to={backTo} className="button secondary big">
            Pick another topic
          </Link>
        </div>
        {!session && (
          <p className="hint">
            <Link to="/login">Sign in for free</Link> to save your progress and keep a streak.
          </p>
        )}
      </section>
    )
  }

  if (!question) {
    return (
      <section className="panel quiz summary">
        {onlyDue ? (
          <>
            <div className="big-emoji" aria-hidden="true" style={{ fontSize: '3rem' }}>
              🎉
            </div>
            <h2>You're all caught up</h2>
            <p className="hint">Questions you miss come back here when they're due. Keep practicing to build your review list.</p>
            <Link to="/practice" className="button big">
              Practice a topic
            </Link>
          </>
        ) : (
          <>
            <div className="big-emoji" aria-hidden="true" style={{ fontSize: '3rem' }}>
              ✍️
            </div>
            <h2>Questions coming soon</h2>
            <p className="hint">We're still writing questions for this topic. In the meantime, the tutor can help you learn it.</p>
            <Link to="/tutor" className="button big">
              Ask the tutor
            </Link>
          </>
        )}
      </section>
    )
  }

  const answerText = `${LETTERS[question.answer_index!]}. ${question.choices![question.answer_index!]}`
  const streak = (() => {
    let n = 0
    for (let i = results.length - 1; i >= 0 && results[i].correct; i--) n++
    return n
  })()
  const done = index + (answered ? 1 : 0)
  const topicName = topicIds.length !== 1 ? topicById(question.topic_id)?.name : null

  return (
    <section className="panel quiz" aria-live="polite">
      {cheer && (
        <span key={cheer.key} className="burst" aria-hidden="true">
          {cheer.emoji}
        </span>
      )}

      <div className="quiz-top">
        <div
          className="progress"
          role="progressbar"
          aria-label="Round progress"
          aria-valuemin={0}
          aria-valuemax={round.length}
          aria-valuenow={done}
        >
          <span style={{ width: `${(done / round.length) * 100}%` }} />
        </div>
        <span className={`streak${streak >= 2 ? ' bump' : ''}`} key={streak} aria-label={`${streak} in a row`}>
          {streak >= 2 ? `🔥 ${streak}` : ''}
        </span>
      </div>

      <div className="quiz-meta">
        <span>
          Question {index + 1} of {round.length}
          {topicName && <> · {topicName}</>}
        </span>
        <ReviewBadge reviewed={question.reviewed} />
      </div>

      {question.passage && <blockquote className="passage">{question.passage}</blockquote>}

      <h2 className="prompt">{question.prompt}</h2>

      <div className="choices">
        {(question.choices ?? []).map((c, i) => {
          const state = !answered ? '' : i === question.answer_index ? 'correct' : i === result.picked ? 'wrong' : 'dim'
          return (
            <button key={i} type="button" className={`choice ${state}`} disabled={answered} onClick={() => submit(i)}>
              <span className="letter">{LETTERS[i]}</span> {c}
            </button>
          )
        })}
      </div>

      {answered ? (
        <div className={`feedback ${result.correct ? 'good' : 'bad'}`}>
          <p className="feedback-title">{feedbackTitle}</p>
          {!result.correct && <p>The answer is {answerText}</p>}
          {question.answer_explanation && <p>{question.answer_explanation}</p>}
          {question.related_part_id && <RelatedAnatomy key={question.id} partId={question.related_part_id} />}
          <div className="row">
            <button type="button" className="big" onClick={next} autoFocus>
              {index + 1 < round.length ? 'Next question →' : 'See my results →'}
            </button>
            <button type="button" className="secondary small" onClick={() => speak(question.answer_explanation ?? answerText)}>
              🔊 Read it
            </button>
          </div>
          <ReportButton
            targetType="question"
            targetId={question.id}
            textShown={`${question.passage ? `${question.passage}\n\n` : ''}${question.prompt}\n${question.choices!.map((c, i) => `${LETTERS[i]}. ${c}`).join('\n')}\nMarked answer: ${LETTERS[question.answer_index!]}`}
          />
        </div>
      ) : (
        <div className="row">
          <button type="button" className="secondary small" onClick={() => speak(spoken(question))}>
            🔊 Read question aloud
          </button>
          {question.source_name && (
            <span className="small">
              {question.source_url ? (
                <a href={question.source_url} target="_blank" rel="noreferrer">
                  {question.source_name}
                </a>
              ) : (
                question.source_name
              )}
            </span>
          )}
        </div>
      )}

      <p className="kbd-hint">
        Tip: press <kbd>A</kbd>–<kbd>D</kbd> to answer and <kbd>Enter</kbd> for the next question.
      </p>

      {!session && (
        <p className="hint small">
          <Link to="/login">Sign in for free</Link> to save your misses and get review reminders.
        </p>
      )}
      {saveFailed && <p className="error">Couldn't save that answer. Your progress may be out of date.</p>}
    </section>
  )
}
