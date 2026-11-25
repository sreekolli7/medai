import { Component, lazy, Suspense, type ReactNode } from 'react'
import { modelById } from '../lib/anatomy'
import type { OrganViewProps } from './Organ3D'

const RELOAD_KEY = 'organ3d-reloaded'

const Organ3D = lazy(() =>
  import('./Organ3D').then((m) => {
    sessionStorage.removeItem(RELOAD_KEY)
    return m
  }),
)

class WebGlBoundary extends Component<{ children: ReactNode }, { failed: boolean; reason: string }> {
  state = { failed: false, reason: '' }
  static getDerivedStateFromError(error: unknown) {
    return { failed: true, reason: error instanceof Error ? error.message : String(error) }
  }
  componentDidCatch(error: unknown) {
    // After a deploy, an open tab asks for code chunks that no longer exist; one reload fixes it.
    const stale = error instanceof Error && /dynamically imported module|Importing a module script failed/i.test(error.message)
    if (stale && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1')
      window.location.reload()
    }
  }
  render() {
    return this.state.failed ? (
      <div className="heart3d-loading">
        <p>
          Couldn't show the 3D model.{' '}
          <button type="button" className="secondary small" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
        {this.state.reason && <p className="small">{this.state.reason}</p>}
      </div>
    ) : (
      this.props.children
    )
  }
}

export function OrganView(props: OrganViewProps) {
  return (
    <WebGlBoundary>
      <Suspense
        fallback={
          <div className={`heart3d-loading${props.compact ? ' compact' : ''}`}>
            Loading the 3D {modelById(props.model)?.title.toLowerCase() ?? 'model'}…
          </div>
        }
      >
        <Organ3D {...props} />
      </Suspense>
    </WebGlBoundary>
  )
}
