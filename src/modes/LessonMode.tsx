import { useEffect, useRef, useState } from 'react'
import { HeartView } from '../components/HeartView'
import { useAuth } from '../lib/auth'
import { useContent } from '../lib/content'
import { partScript, speak, stopSpeaking } from '../lib/speech'
import { loadSrs } from '../lib/srs'
import type { Part } from '../types'

export function LessonMode() {
  const { parts } = useContent()
  const { session } = useAuth()
  const userId = session?.user.id
  const [order, setOrder] = useState<Part[]>(parts)
  const [missedIds, setMissedIds] = useState<Set<string>>(new Set())
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const runId = useRef(0)

  useEffect(() => {
    ;(async () => {
      const srs = userId ? await loadSrs() : []
      const misses = new Map(srs.map((r) => [r.part_id, r.misses]))
      const missed = parts.filter((p) => (misses.get(p.id) ?? 0) > 0)
      missed.sort((a, b) => (misses.get(b.id) ?? 0) - (misses.get(a.id) ?? 0))
      const rest = parts.filter((p) => !missed.includes(p))
      setMissedIds(new Set(missed.map((p) => p.id)))
      setOrder([...missed, ...rest])
    })()
  }, [parts, userId])

  useEffect(
    () => () => {
      runId.current++
      stopSpeaking()
    },
    [],
  )

  const playFrom = async (start: number) => {
    const id = ++runId.current
    setPlaying(true)
    for (let i = start; i < order.length; i++) {
      if (runId.current !== id) return
      setIndex(i)
      await speak(partScript(order[i]), order[i].audio_url)
      if (runId.current !== id) return
      await new Promise((r) => setTimeout(r, 700))
    }
    if (runId.current === id) {
      setPlaying(false)
      setIndex(0)
    }
  }

  const pause = () => {
    runId.current++
    stopSpeaking()
    setPlaying(false)
  }

  const current = order[index]

  return (
    <>
      <div className="diagram-col">
        <HeartView
          parts={parts}
          selectedId={current?.id}
          onSelect={(id) => {
            const i = order.findIndex((p) => p.id === id)
            if (i >= 0) playFrom(i)
          }}
        />
      </div>
      <section className="panel" aria-live="polite">
        <h2>Audio lesson</h2>
        <p className="hint">
          Hands-free walkthrough of the heart.{' '}
          {missedIds.size > 0 ? 'Parts you missed in quizzes come first.' : 'Take a quiz and your misses will come first next time.'}
        </p>
        <div className="row big-controls">
          {playing ? (
            <button type="button" onClick={pause}>
              ❚❚ Pause
            </button>
          ) : (
            <button type="button" onClick={() => playFrom(index)}>
              ▶ {index > 0 ? 'Resume' : 'Start lesson'}
            </button>
          )}
          <button type="button" className="secondary" onClick={() => playFrom(Math.min(index + 1, order.length - 1))}>
            Skip ⏭
          </button>
        </div>
        <ol className="lesson-list">
          {order.map((p, i) => (
            <li key={p.id} className={i === index ? 'current' : ''}>
              <button type="button" className="link-button" onClick={() => playFrom(i)}>
                {p.name}
              </button>
              {missedIds.has(p.id) && <span className="badge missed">missed</span>}
            </li>
          ))}
        </ol>
      </section>
    </>
  )
}
