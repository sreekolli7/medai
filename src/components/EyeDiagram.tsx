import type { KeyboardEvent, ReactNode } from 'react'
import type { Part } from '../types'

type Props = {
  parts: Part[]
  selectedId?: string | null
  feedback?: Record<string, 'correct' | 'wrong'>
  showLabels?: boolean
  onSelect: (id: string) => void
  ariaLabel?: string
}

const LABEL: Record<string, { name: string; x: number; y: number; anchor?: 'start' | 'middle' | 'end' }> = {
  'eye-cornea': { name: 'Cornea', x: 78, y: 78 },
  'eye-anterior-chamber': { name: 'Anterior chamber', x: 78, y: 108 },
  'eye-iris': { name: 'Iris', x: 150, y: 352, anchor: 'middle' },
  'eye-lens': { name: 'Lens', x: 232, y: 352, anchor: 'middle' },
  'eye-zonule': { name: 'Zonule', x: 300, y: 78 },
  'eye-vitreous': { name: 'Vitreous', x: 400, y: 214, anchor: 'middle' },
  'eye-retina': { name: 'Retina', x: 612, y: 96, anchor: 'end' },
  'eye-choroid': { name: 'Choroid', x: 612, y: 118, anchor: 'end' },
  'eye-sclera': { name: 'Sclera', x: 612, y: 140, anchor: 'end' },
  'eye-optic-nerve': { name: 'Optic nerve', x: 612, y: 330, anchor: 'end' },
}

/** A simplified side view of a human eye, cut through the middle. Original drawing. */
export function EyeDiagram({ parts, selectedId, feedback = {}, showLabels = true, onSelect, ariaLabel }: Props) {
  const known = new Set(parts.map((p) => p.id))

  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  const part = (id: string, children: ReactNode) => {
    if (!known.has(id)) return null
    const state = [selectedId === id ? 'selected' : '', feedback[id] ?? ''].filter(Boolean).join(' ')
    return (
      <g
        className={`eye-part ${state}`}
        role="button"
        tabIndex={0}
        aria-label={showLabels ? (parts.find((p) => p.id === id)?.name ?? id) : 'Unlabeled part of the eye'}
        aria-pressed={selectedId === id}
        onClick={() => onSelect(id)}
        onKeyDown={(e) => onKey(e, id)}
      >
        {children}
      </g>
    )
  }

  return (
    <figure className="eye-diagram">
      <svg viewBox="0 0 640 390" role="group" aria-label={ariaLabel ?? 'Simplified side view of a human eye. Choose a part.'}>
        <text className="eye-note" x="16" y="28">
          Light →
        </text>

        {part(
          'eye-optic-nerve',
          <path className="eye-fill nerve" d="M500 176 C545 170 585 166 630 160 L632 244 C584 236 544 230 500 222 Z" />,
        )}
        {part(
          'eye-sclera',
          <path
            className="eye-fill sclera"
            fillRule="evenodd"
            d="M214 78 C270 46 350 34 418 34 C520 34 575 104 575 200 C575 296 520 366 418 366 C350 366 270 354 214 322 L214 292 C262 318 346 330 412 330 C488 330 535 276 535 200 C535 124 488 70 412 70 C346 70 262 82 214 108 Z"
          />,
        )}
        {part(
          'eye-choroid',
          <path
            className="eye-line choroid"
            d="M214 108 C262 82 346 70 412 70 C488 70 535 124 535 200 C535 276 488 330 412 330 C346 330 262 318 214 292"
          />,
        )}
        {part(
          'eye-retina',
          <path
            className="eye-line retina"
            d="M220 122 C266 98 346 88 408 88 C476 88 518 136 518 200 C518 264 476 312 408 312 C346 312 266 302 220 278"
          />,
        )}
        {part('eye-vitreous', <ellipse className="eye-fill vitreous" cx="385" cy="200" rx="125" ry="82" />)}
        {part(
          'eye-cornea',
          <path className="eye-fill cornea" d="M214 100 C130 112 108 150 108 200 C108 250 130 288 214 300 C178 258 172 142 214 100 Z" />,
        )}
        {part(
          'eye-anterior-chamber',
          <path className="eye-fill chamber" d="M188 128 C150 148 142 172 142 200 C142 228 150 252 188 272 C196 236 196 164 188 128 Z" />,
        )}
        {part(
          'eye-lens',
          <path className="eye-fill lens" d="M196 150 C246 172 246 228 196 250 C158 228 158 172 196 150 Z" />,
        )}
        {part(
          'eye-iris',
          <g className="eye-fill iris">
            <path d="M176 118 C206 136 214 160 210 178 L168 178 C160 156 158 136 176 118 Z" />
            <path d="M176 282 C158 264 160 244 168 222 L210 222 C214 240 206 264 176 282 Z" />
          </g>,
        )}
        {part(
          'eye-zonule',
          <g className="eye-line zonule">
            <path d="M198 154 L250 112" />
            <path d="M196 158 L252 124" />
            <path d="M198 246 L250 288" />
            <path d="M196 242 L252 276" />
          </g>,
        )}

        {showLabels &&
          Object.entries(LABEL)
            .filter(([id]) => known.has(id))
            .map(([id, l]) => (
              <text
                key={id}
                className={`eye-label${selectedId === id ? ' on' : ''}`}
                x={l.x}
                y={l.y}
                textAnchor={l.anchor ?? 'start'}
              >
                {l.name}
              </text>
            ))}
      </svg>
      <figcaption>Side view, cut through the middle. The dark opening is the pupil, which the iris widens and narrows.</figcaption>
    </figure>
  )
}
