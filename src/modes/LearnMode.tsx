import { useEffect, useState } from 'react'
import { HeartView } from '../components/HeartView'
import { ReportButton } from '../components/ReportButton'
import { ReviewBadge } from '../components/ReviewBadge'
import { useContent } from '../lib/content'
import { usePrefs } from '../lib/prefs'
import { partScript, speak, stopSpeaking } from '../lib/speech'

export function LearnMode({ initialPartId }: { initialPartId?: string | null }) {
  const { parts, partById } = useContent()
  const { voiceOn } = usePrefs()
  const [selectedId, setSelectedId] = useState<string | null>(initialPartId ?? null)
  const part = selectedId ? partById(selectedId) : undefined

  useEffect(() => () => stopSpeaking(), [])

  const select = (id: string) => {
    setSelectedId(id)
    const p = partById(id)
    if (p && voiceOn) speak(partScript(p), p.audio_url)
  }

  return (
    <>
      <div className="diagram-col">
        <HeartView parts={parts} selectedId={selectedId} onSelect={select} />
        <p className="legend">
          <span className="swatch poor" /> oxygen-poor <span className="swatch rich" /> oxygen-rich
        </p>
      </div>
      <section className="panel" aria-live="polite">
        {!part ? (
          <div className="empty">
            <h2>Tap any part of the heart</h2>
            <p>You'll see what it is, what it does, and an exam pearl. Turn the voice on to hear it too.</p>
          </div>
        ) : (
          <article>
            <div className="part-head">
              <h2>{part.name}</h2>
              <ReviewBadge reviewed={part.reviewed} />
            </div>
            <p>{part.explanation}</p>
            <div className="pearl">
              <strong>Exam pearl:</strong> {part.exam_pearl}
            </div>
            <div className="row">
              <button type="button" onClick={() => speak(partScript(part), part.audio_url)}>
                ▶ Play
              </button>
              <button type="button" className="secondary" onClick={stopSpeaking}>
                ■ Stop
              </button>
            </div>
            <ReportButton
              targetType="part"
              targetId={part.id}
              textShown={`${part.explanation}\nExam pearl: ${part.exam_pearl}`}
            />
          </article>
        )}
      </section>
    </>
  )
}
