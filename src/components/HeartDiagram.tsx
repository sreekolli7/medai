import type { KeyboardEvent } from 'react'
import type { Part } from '../types'

type Shape =
  | { kind: 'fill'; d: string }
  | { kind: 'vessel'; d: string; width: number }

// Schematic front view: the patient's right is on the viewer's left.
const SHAPES: Record<string, { shapes: Shape[]; label: string; lx: number; ly: number }> = {
  'superior-vena-cava': {
    shapes: [{ kind: 'vessel', d: 'M 130 30 L 130 170', width: 40 }],
    label: 'SVC',
    lx: 130,
    ly: 70,
  },
  aorta: {
    shapes: [{ kind: 'vessel', d: 'M 222 230 C 212 150 205 80 250 58 C 295 38 338 62 342 105 L 344 190', width: 34 }],
    label: 'Aorta',
    lx: 272,
    ly: 40,
  },
  'right-atrium': {
    shapes: [{ kind: 'fill', d: 'M 78 200 C 78 150 118 140 150 145 C 192 152 205 190 200 228 C 196 262 160 272 128 268 C 92 262 78 240 78 200 Z' }],
    label: 'Right atrium',
    lx: 140,
    ly: 210,
  },
  'left-atrium': {
    shapes: [{ kind: 'fill', d: 'M 250 185 C 252 155 285 145 315 150 C 345 155 360 175 356 200 C 352 228 320 236 290 232 C 262 228 248 210 250 185 Z' }],
    label: 'Left atrium',
    lx: 303,
    ly: 195,
  },
  'right-ventricle': {
    shapes: [{ kind: 'fill', d: 'M 105 272 C 150 262 200 252 238 250 C 246 300 252 360 268 420 C 205 410 150 370 118 320 C 108 305 103 288 105 272 Z' }],
    label: 'Right ventricle',
    lx: 180,
    ly: 320,
  },
  'left-ventricle': {
    shapes: [{ kind: 'fill', d: 'M 238 250 C 280 244 330 238 362 236 C 378 300 360 380 290 432 C 282 430 274 426 268 420 C 252 360 246 300 238 250 Z' }],
    label: 'Left ventricle',
    lx: 310,
    ly: 320,
  },
  'pulmonary-artery': {
    shapes: [
      { kind: 'vessel', d: 'M 200 262 C 215 215 238 170 250 130', width: 30 },
      { kind: 'vessel', d: 'M 250 130 L 398 118', width: 20 },
      { kind: 'vessel', d: 'M 250 130 L 175 116', width: 20 },
    ],
    label: 'Pulmonary artery',
    lx: 330,
    ly: 100,
  },
  'pulmonary-veins': {
    shapes: [
      { kind: 'vessel', d: 'M 410 170 L 350 180', width: 14 },
      { kind: 'vessel', d: 'M 410 205 L 352 205', width: 14 },
    ],
    label: 'Pulmonary veins',
    lx: 380,
    ly: 240,
  },
}

// Drawing order: vessels behind, chambers, then vessels that sit in front.
const DRAW_ORDER = [
  'superior-vena-cava',
  'aorta',
  'right-atrium',
  'left-atrium',
  'pulmonary-veins',
  'right-ventricle',
  'left-ventricle',
  'pulmonary-artery',
]

type Props = {
  parts: Part[]
  selectedId?: string | null
  feedback?: Record<string, 'correct' | 'wrong'>
  showLabels?: boolean
  onSelect: (id: string) => void
  ariaLabel?: string
}

export function HeartDiagram({ parts, selectedId, feedback = {}, showLabels = true, onSelect, ariaLabel }: Props) {
  const known = new Map(parts.map((p) => [p.id, p]))

  const onKey = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(id)
    }
  }

  return (
    <svg
      className="heart"
      viewBox="40 0 400 450"
      role="group"
      aria-label={ariaLabel ?? 'Heart diagram. Choose a part.'}
    >
      {DRAW_ORDER.filter((id) => known.has(id)).map((id) => {
        const part = known.get(id)!
        const def = SHAPES[id]
        const classes = [
          'part',
          part.blood === 'oxygen-rich' ? 'rich' : 'poor',
          selectedId === id ? 'selected' : '',
          feedback[id] ?? '',
        ].join(' ')
        return (
          <g
            key={id}
            className={classes}
            role="button"
            tabIndex={0}
            aria-label={showLabels ? part.name : 'Unlabeled heart part'}
            aria-pressed={selectedId === id}
            onClick={() => onSelect(id)}
            onKeyDown={(e) => onKey(e, id)}
          >
            {def.shapes.map((s, i) =>
              s.kind === 'fill' ? (
                <path key={i} className="shape fill" d={s.d} />
              ) : (
                <g key={i}>
                  <path className="shape vessel-outline" d={s.d} strokeWidth={s.width + 4} />
                  <path className="shape vessel" d={s.d} strokeWidth={s.width} />
                </g>
              ),
            )}
          </g>
        )
      })}
      {showLabels &&
        DRAW_ORDER.filter((id) => known.has(id)).map((id) => (
          <text key={id} className="label" x={SHAPES[id].lx} y={SHAPES[id].ly} textAnchor="middle">
            {SHAPES[id].label}
          </text>
        ))}
    </svg>
  )
}
