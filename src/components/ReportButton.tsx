import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { supabase } from '../lib/supabase'
import type { ReportTarget } from '../types'

type Props = { targetType: ReportTarget; targetId?: string | number | null; textShown: string }

export function ReportButton({ targetType, targetId, textShown }: Props) {
  const { session } = useAuth()
  const [open, setOpen] = useState(false)
  const [note, setNote] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')

  if (state === 'sent') return <p className="report-thanks">Thanks! A reviewer will take a look.</p>

  if (!open) {
    return (
      <button type="button" className="link-button report-toggle" onClick={() => setOpen(true)}>
        This looks wrong
      </button>
    )
  }

  if (!session) {
    return (
      <p className="report-box">
        <Link to="/login">Sign in</Link> to send a report so we can follow up.
      </p>
    )
  }

  const send = async () => {
    setState('sending')
    const { error } = await supabase.from('reports').insert({
      target_type: targetType,
      target_id: targetId == null ? null : String(targetId),
      text_shown: textShown.slice(0, 4000),
      note: note.trim().slice(0, 2000) || null,
    })
    setState(error ? 'error' : 'sent')
  }

  return (
    <div className="report-box">
      <label htmlFor={`report-${targetType}-${targetId}`}>What looks wrong? (optional)</label>
      <textarea
        id={`report-${targetType}-${targetId}`}
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. My textbook says something different"
      />
      <div className="row">
        <button type="button" onClick={send} disabled={state === 'sending'}>
          {state === 'sending' ? 'Sending…' : 'Send report'}
        </button>
        <button type="button" className="secondary" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
      {state === 'error' && <p className="error">Couldn't send that. Try again.</p>}
    </div>
  )
}
