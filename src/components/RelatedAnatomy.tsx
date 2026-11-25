import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchPart, modelById, useModelParts } from '../lib/anatomy'
import type { Part } from '../types'
import { OrganView } from './OrganView'

/** "See it in 3D" for a question linked to a structure. The model only loads when opened. */
export function RelatedAnatomy({ partId }: { partId: string }) {
  const [part, setPart] = useState<Part | null>(null)
  const [open, setOpen] = useState(false)
  const { parts } = useModelParts(open ? part?.model : undefined)
  const info = modelById(part?.model)

  useEffect(() => {
    let cancelled = false
    fetchPart(partId).then((p) => !cancelled && setPart(p))
    return () => {
      cancelled = true
    }
  }, [partId])

  if (!part || !info) return null

  return (
    <div className="related-3d">
      <button type="button" className="secondary small" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? 'Hide 3D' : `🧊 See it in 3D: ${part.name}`}
      </button>
      {open && (
        <>
          <OrganView
            model={info.id}
            parts={parts.length ? parts : [part]}
            selectedId={part.id}
            focus
            compact
            ariaLabel={`3D ${info.title.toLowerCase()} with the ${part.name} highlighted.`}
          />
          <p className="small">
            <strong>{part.name}:</strong> {part.explanation}{' '}
            <Link to={`/anatomy/${info.id}/learn?part=${part.id}`}>Explore the {info.title.toLowerCase()} →</Link>
          </p>
        </>
      )}
    </div>
  )
}
