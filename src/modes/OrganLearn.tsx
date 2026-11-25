import { useEffect, useState } from 'react'
import { EyeDiagram } from '../components/EyeDiagram'
import { OrganView } from '../components/OrganView'
import { ReportButton } from '../components/ReportButton'
import { ReviewBadge } from '../components/ReviewBadge'
import { modelById } from '../lib/anatomy'
import { usePrefs } from '../lib/prefs'
import { partScript, speak, stopSpeaking } from '../lib/speech'
import type { Part } from '../types'

/** Tap any part of a 3D model (or pick it from the list) to read and hear about it. */
export function OrganLearn({ model, parts, initialPartId }: { model: string; parts: Part[]; initialPartId?: string | null }) {
  const { voiceOn } = usePrefs()
  const [selectedId, setSelectedId] = useState<string | null>(initialPartId ?? null)
  const [simple, setSimple] = useState(model === 'eye')
  const part = parts.find((p) => p.id === selectedId)
  const title = modelById(model)?.title.toLowerCase() ?? 'model'

  useEffect(() => () => stopSpeaking(), [])

  const select = (id: string) => {
    setSelectedId(id)
    const p = parts.find((x) => x.id === id)
    if (p && voiceOn) speak(partScript(p), p.audio_url)
  }

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
          <EyeDiagram parts={parts} selectedId={selectedId} onSelect={select} />
        ) : (
          <OrganView model={model} parts={parts} selectedId={selectedId} onSelect={select} focus={!!initialPartId} />
        )}
        <div className="part-chips" role="list" aria-label="All parts">
          {parts.map((p) => (
            <button
              key={p.id}
              type="button"
              role="listitem"
              className={`chip${p.id === selectedId ? ' active' : ''}`}
              aria-pressed={p.id === selectedId}
              onClick={() => select(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>
      <section className="panel" aria-live="polite">
        {!part ? (
          <div className="empty">
            <h2>Tap any part of the {title}</h2>
            <p>
              {model === 'eye' && simple
                ? 'Or pick one from the list. This is a side view cut through the middle, the way eye diagrams are usually drawn. Switch to 3D scan for the real anatomy.'
                : 'Or pick one from the list. Use See inside to reveal deeper structures and Pull apart to spread them out.'}
            </p>
          </div>
        ) : !part.explanation ? (
          <article>
            <h2>{part.name}</h2>
            <p className="hint">Notes for this part are unavailable right now. Refresh in a bit to load them.</p>
          </article>
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
