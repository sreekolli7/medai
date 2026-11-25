import { useEffect, useState } from 'react'
import { EyeDiagram } from '../components/EyeDiagram'
import { OrganView } from '../components/OrganView'
import { modelById } from '../lib/anatomy'
import { usePrefs } from '../lib/prefs'
import { speak, stopSpeaking } from '../lib/speech'
import type { Part } from '../types'

const shuffle = <T,>(items: T[]) => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

type Answer = { picked: string; correct: boolean }

/** "Find it" quiz: we name a structure, you tap it on the model. */
export function OrganFind({ model, parts }: { model: string; parts: Part[] }) {
  const { voiceOn } = usePrefs()
  const [queue, setQueue] = useState(() => shuffle(parts))
  const [index, setIndex] = useState(0)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [score, setScore] = useState({ right: 0, total: 0 })
  const [simple, setSimple] = useState(model === 'eye')
  const target = queue[index]
  const title = modelById(model)?.title.toLowerCase() ?? 'model'

  useEffect(() => {
    if (target && voiceOn) speak(`Find: ${target.name}.`)
    return () => stopSpeaking()
  }, [target, voiceOn])

  if (!target) return <section className="panel full">No parts to quiz on yet.</section>

  const submit = (picked: string) => {
    if (answer) return
    const correct = picked === target.id
    setAnswer({ picked, correct })
    setScore((s) => ({ right: s.right + (correct ? 1 : 0), total: s.total + 1 }))
    if (voiceOn) speak(correct ? `Correct. ${target.name}.` : `Not quite. Here's the ${target.name}.`)
  }

  const next = () => {
    setAnswer(null)
    if (index + 1 < queue.length) setIndex(index + 1)
    else {
      setQueue(shuffle(parts))
      setIndex(0)
    }
  }

  const feedback: Record<string, 'correct' | 'wrong'> = {}
  if (answer) {
    feedback[target.id] = 'correct'
    if (!answer.correct) feedback[answer.picked] = 'wrong'
  }
  const pickedName = answer && parts.find((p) => p.id === answer.picked)?.name

  return (
    <>
      <div className="diagram-col">
        {model === 'eye' && (
          <div className="view-toggle" role="group" aria-label="Eye view">
            <button type="button" className={simple ? 'tab active' : 'tab'} onClick={() => setSimple(true)}>
              Simple
            </button>
            <button type="button" className={simple ? 'tab' : 'tab active'} onClick={() => setSimple(false)}>
              3D scan
            </button>
          </div>
        )}
        {model === 'eye' && simple ? (
          <EyeDiagram
            parts={parts}
            showLabels={!!answer}
            feedback={feedback}
            onSelect={submit}
            ariaLabel="Simplified eye with labels hidden. Tap the part that answers the question."
          />
        ) : (
          <OrganView
            model={model}
            parts={parts}
            showLabels={!!answer}
            feedback={feedback}
            onSelect={submit}
            ariaLabel={`${title} with labels hidden. Tap the part that answers the question.`}
          />
        )}
      </div>
      <section className="panel" aria-live="polite">
        <div className="quiz-meta">
          <span>
            Part {index + 1} of {queue.length}
          </span>
          <span>
            Score {score.right}/{score.total}
          </span>
        </div>
        <h2 className="prompt">
          <span className="hint">Find:</span> {target.name}
        </h2>
        {!answer ? (
          <p className="hint">
            Tap it on the {title}. Hidden deep inside? Use <strong>See inside</strong> or <strong>Pull apart</strong>.
          </p>
        ) : (
          <div className={`feedback ${answer.correct ? 'good' : 'bad'}`}>
            <p>
              <strong>{answer.correct ? 'Correct!' : 'Not quite.'}</strong>{' '}
              {answer.correct ? `That's the ${target.name}.` : `You tapped the ${pickedName}. The ${target.name} is shown in green.`}
            </p>
            <p className="small">{target.explanation}</p>
            <button type="button" onClick={next} autoFocus>
              Next part →
            </button>
          </div>
        )}
        <p className="hint small">Practice only: these taps aren't added to your progress.</p>
      </section>
    </>
  )
}
