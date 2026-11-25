import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { HeartView } from '../components/HeartView'
import { ReportButton } from '../components/ReportButton'
import { ReviewBadge } from '../components/ReviewBadge'
import { useAuth } from '../lib/auth'
import { useContent } from '../lib/content'
import { usePrefs } from '../lib/prefs'
import { speak, stopSpeaking } from '../lib/speech'
import { loadSrs, orderQuestions, recordAttempt } from '../lib/srs'
import type { Question } from '../types'

type Answer = { picked: string; correct: boolean }

/** "Tap the part" quiz on the 3D model. Misses feed the part's spaced-repetition schedule. */
export function QuizMode() {
  const { parts, questions, partById } = useContent()
  const { session } = useAuth()
  const userId = session?.user.id
  const { voiceOn } = usePrefs()
  const [queue, setQueue] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const srs = userId ? await loadSrs() : []
      if (!cancelled) {
        setQueue(orderQuestions(questions, srs))
        setIndex(0)
        setAnswer(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [questions, userId])

  const question = queue[index]

  useEffect(() => {
    if (question && voiceOn) speak(question.prompt)
    return () => stopSpeaking()
  }, [question, voiceOn])

  if (!question) return <section className="panel full">No tap questions yet.</section>

  const correctPart = partById(question.correct_part_id ?? '')

  const submit = async (picked: string) => {
    if (answer) return
    const correct = picked === question.correct_part_id
    setAnswer({ picked, correct })
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }))
    if (voiceOn) speak(correct ? `Correct. ${correctPart?.name}` : `Not quite. The answer is the ${correctPart?.name}.`)
    if (userId) setSaveFailed(!(await recordAttempt(question.id, correct)))
  }

  const next = async () => {
    setAnswer(null)
    if (index + 1 < queue.length) {
      setIndex(index + 1)
      return
    }
    setQueue(orderQuestions(questions, userId ? await loadSrs() : []))
    setIndex(0)
  }

  const feedback: Record<string, 'correct' | 'wrong'> = {}
  if (answer) {
    feedback[question.correct_part_id!] = 'correct'
    if (!answer.correct) feedback[answer.picked] = 'wrong'
  }

  return (
    <>
      <div className="diagram-col">
        <HeartView
          parts={parts}
          showLabels={!!answer}
          feedback={feedback}
          onSelect={submit}
          ariaLabel="Heart with labels hidden. Choose the part that answers the question."
        />
      </div>
      <section className="panel" aria-live="polite">
        <div className="quiz-meta">
          <span>
            Question {index + 1} of {queue.length}
          </span>
          <span>
            Score {score.right}/{score.total}
          </span>
        </div>
        <h2 className="prompt">{question.prompt}</h2>
        <div className="row">
          <ReviewBadge reviewed={question.reviewed} />
          <button type="button" className="secondary small" onClick={() => speak(question.prompt)}>
            🔊 Read it again
          </button>
        </div>

        {!answer ? (
          <p className="hint">Tap the part on the heart.</p>
        ) : (
          <div className={`feedback ${answer.correct ? 'good' : 'bad'}`}>
            <p>
              <strong>{answer.correct ? 'Correct!' : 'Not quite.'}</strong>{' '}
              {answer.correct
                ? `It's the ${correctPart?.name}.`
                : `You picked the ${partById(answer.picked)?.name}. The answer is the ${correctPart?.name}.`}
            </p>
            {correctPart && <p className="small">{correctPart.exam_pearl}</p>}
            <button type="button" onClick={next}>
              Next question →
            </button>
            <ReportButton targetType="question" targetId={question.id} textShown={question.prompt} />
          </div>
        )}

        {!session && (
          <p className="hint">
            <Link to="/login">Sign in</Link> to save your misses and get a spaced-repetition schedule.
          </p>
        )}
        {saveFailed && <p className="error">Couldn't save that answer. Your progress may be out of date.</p>}
      </section>
    </>
  )
}
