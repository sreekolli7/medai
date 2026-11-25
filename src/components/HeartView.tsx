import { Component, lazy, Suspense, type ReactNode } from 'react'
import { usePrefs } from '../lib/prefs'
import { HeartDiagram } from './HeartDiagram'
import type { HeartViewProps } from './Heart3D'

const Heart3D = lazy(() => import('./Heart3D'))

class Fallback2D extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** 3D heart by default, with a 2D diagram toggle (and automatic fallback if WebGL fails). */
export function HeartView(props: HeartViewProps) {
  const { view, setView } = usePrefs()
  const flat = <HeartDiagram {...props} />

  return (
    <div className="heart-view">
      <div className="view-toggle" role="group" aria-label="Diagram style">
        <button type="button" className={view === '3d' ? 'tab active' : 'tab'} onClick={() => setView('3d')}>
          3D
        </button>
        <button type="button" className={view === '2d' ? 'tab active' : 'tab'} onClick={() => setView('2d')}>
          2D
        </button>
      </div>
      {view === '2d' ? (
        flat
      ) : (
        <Fallback2D fallback={flat}>
          <Suspense fallback={<div className="heart3d-loading">Loading the 3D heart…</div>}>
            <Heart3D {...props} />
          </Suspense>
        </Fallback2D>
      )}
    </div>
  )
}
