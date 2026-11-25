import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ScreenHead } from '../components/ScreenHead'
import { MODELS, modelById, useModelParts } from '../lib/anatomy'
import { useCatalog } from '../lib/catalog'
import { useContent } from '../lib/content'
import { LearnMode } from '../modes/LearnMode'
import { LessonMode } from '../modes/LessonMode'
import { OrganFind } from '../modes/OrganFind'
import { OrganLearn } from '../modes/OrganLearn'
import { QuizMode } from '../modes/QuizMode'

const HEART_MODES = [
  { id: 'learn', icon: '👆', title: 'Learn the parts', body: 'Tap any part to see and hear what it does, plus an exam pearl.' },
  { id: 'quiz', icon: '✅', title: 'Tap quiz', body: 'We name it, you find it on the model.' },
  { id: 'lesson', icon: '🎧', title: 'Audio lesson', body: 'Hands-free walkthrough. Parts you missed come first.' },
] as const

const ORGAN_MODES = [
  { id: 'learn', icon: '👆', title: 'Learn the parts', body: 'Tap any structure to see what it does, plus an exam pearl.' },
  { id: 'find', icon: '🎯', title: 'Find it', body: 'We name a structure, you find it on the model.' },
] as const

/** /anatomy → pick a model, /anatomy/brain → pick what to do, /anatomy/brain/:mode → do it. */
export function AnatomyPage() {
  const { organ, mode: modeId } = useParams()
  const [params] = useSearchParams()
  const { topicById } = useCatalog()
  const heart = useContent()
  const info = modelById(organ)
  const organParts = useModelParts(info && info.id !== 'heart' ? info.id : undefined)

  if (!organ) {
    return (
      <div className="study">
        <ScreenHead back="/" backLabel="Home" icon="🧍" title="3D anatomy" />
        <p className="hint">Pick a model. Every structure links to the MCAT topics that test it.</p>
        <div className="choices-grid">
          {MODELS.map((m) => (
            <Link key={m.id} to={`/anatomy/${m.id}`} className="choice-card">
              <span className="choice-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span>
                <span className="choice-title">{m.title}</span>
                <span className="choice-body">{m.blurb}</span>
              </span>
            </Link>
          ))}
        </div>
        <p className="hint small">
          The models come from BodyParts3D, which is based on a male body, so the female reproductive organs aren't
          included yet.
        </p>
      </div>
    )
  }

  if (!info) return <Navigate to="/anatomy" replace />
  const isHeart = info.id === 'heart'
  const modes = isHeart ? HEART_MODES : ORGAN_MODES

  if (!modeId) {
    const topics = info.topics.map((id) => topicById(id)).filter((t) => !!t)
    return (
      <div className="study">
        <ScreenHead back="/anatomy" backLabel="Models" icon={info.icon} title={info.title} />
        <p className="hint">What do you want to do?</p>
        <div className="choices-grid">
          {modes.map((m) => (
            <Link key={m.id} to={`/anatomy/${info.id}/${m.id}`} className="choice-card">
              <span className="choice-icon" aria-hidden="true">
                {m.icon}
              </span>
              <span>
                <span className="choice-title">{m.title}</span>
                <span className="choice-body">{m.body}</span>
              </span>
            </Link>
          ))}
          {topics.map((t) => (
            <Link key={t.id} to={`/practice/${t.section_id}/${t.id}`} className="choice-card">
              <span className="choice-icon" aria-hidden="true">
                📝
              </span>
              <span>
                <span className="choice-title">{t.name}</span>
                <span className="choice-body">Practice questions. Linked ones show the structure in 3D.</span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    )
  }

  const mode = modes.find((m) => m.id === modeId)
  if (!mode) return <Navigate to={`/anatomy/${info.id}`} replace />
  const partParam = params.get('part')
  const { loading, error, parts } = isHeart ? heart : organParts

  return (
    <div className="study">
      <ScreenHead back={`/anatomy/${info.id}`} backLabel={info.title} icon={mode.icon} title={mode.title} />
      {!isHeart && error && parts.length > 0 && (
        <p className="panel full error">
          Couldn't reach the server, so the notes are unavailable. You can still explore the model; refresh later for
          the notes.
        </p>
      )}
      {loading ? (
        <p className="panel full">Loading the {info.title.toLowerCase()}…</p>
      ) : error && parts.length === 0 ? (
        <p className="panel full error">{error}</p>
      ) : parts.length === 0 ? (
        <p className="panel full">No content yet.</p>
      ) : (
        <div className="layout">
          {isHeart && mode.id === 'learn' && <LearnMode key={partParam ?? 'none'} initialPartId={partParam} />}
          {isHeart && mode.id === 'quiz' && <QuizMode />}
          {isHeart && mode.id === 'lesson' && <LessonMode />}
          {!isHeart && mode.id === 'learn' && (
            <OrganLearn key={`${info.id}-${partParam ?? 'none'}`} model={info.id} parts={parts} initialPartId={partParam} />
          )}
          {!isHeart && mode.id === 'find' && <OrganFind key={info.id} model={info.id} parts={parts} />}
        </div>
      )}
    </div>
  )
}
