import { Navigate, useParams, useSearchParams } from 'react-router-dom'
import { ScreenHead } from '../components/ScreenHead'
import { ProgressMode } from '../modes/ProgressMode'
import { TutorMode } from '../modes/TutorMode'

export function TutorPage() {
  return (
    <div className="study">
      <ScreenHead back="/" backLabel="Home" icon="💬" title="Ask the tutor" />
      <TutorMode />
    </div>
  )
}

export function ProgressPage() {
  return (
    <div className="study">
      <ScreenHead back="/" backLabel="Home" icon="🎯" title="My progress" />
      <ProgressMode />
    </div>
  )
}

const LEGACY: Record<string, string> = {
  learn: '/anatomy/heart/learn',
  quiz: '/practice',
  lesson: '/anatomy/heart/lesson',
  tutor: '/tutor',
  progress: '/progress',
}

/** Old /study, /study/:mode and /study?mode=… links. */
export function LegacyStudyRedirect() {
  const { mode } = useParams()
  const [params] = useSearchParams()
  const part = params.get('part')
  if (part) return <Navigate to={`/anatomy/heart/learn?part=${part}`} replace />
  return <Navigate to={LEGACY[mode ?? params.get('mode') ?? ''] ?? '/'} replace />
}
