import { useCallback, useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCatalog } from '../lib/catalog'
import { useContent } from '../lib/content'
import { callFunction, supabase } from '../lib/supabase'

type Report = {
  id: number
  target_type: string
  target_id: string | null
  text_shown: string
  note: string | null
  created_at: string
}
type PartRow = { id: string; name: string; explanation: string; exam_pearl: string; reviewed: boolean }
type QuestionRow = {
  id: string
  kind: 'tap' | 'mcq'
  prompt: string
  passage: string | null
  correct_part_id: string | null
  choices: string[] | null
  answer_index: number | null
  answer_explanation: string | null
  reviewed: boolean
}
type ChunkRow = { id: number; title: string; body: string; source_name: string; license: string; reviewed: boolean }
type SpendRow = { day: string; model: string; replies: number; cost_usd: number }

export function AdminPage() {
  const { session, loading, isAdmin } = useAuth()
  const content = useContent()
  const catalog = useCatalog()
  const [topicId, setTopicId] = useState('heart')
  const [reports, setReports] = useState<Report[]>([])
  const [parts, setParts] = useState<PartRow[]>([])
  const [questions, setQuestions] = useState<QuestionRow[]>([])
  const [chunks, setChunks] = useState<ChunkRow[]>([])
  const [spend, setSpend] = useState<SpendRow[]>([])
  const [alerts, setAlerts] = useState<{ day: string; total_usd: number }[]>([])
  const [showAll, setShowAll] = useState(false)
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [r, p, q, c, s, a] = await Promise.all([
      supabase.from('reports').select('*').eq('status', 'open').order('created_at', { ascending: false }),
      supabase.from('parts').select('id, name, explanation, exam_pearl, reviewed').eq('topic_id', topicId).order('sort_order'),
      supabase
        .from('questions')
        .select('id, kind, prompt, passage, correct_part_id, choices, answer_index, answer_explanation, reviewed')
        .eq('topic_id', topicId)
        .order('id'),
      supabase
        .from('content_chunks')
        .select('id, title, body, source_name, license, reviewed')
        .eq('topic_id', topicId)
        .order('id')
        .limit(300),
      supabase.from('daily_spend').select('day, model, replies, cost_usd').order('day', { ascending: false }).limit(30),
      supabase.from('spend_alerts').select('day, total_usd').order('day', { ascending: false }).limit(10),
    ])
    setReports((r.data ?? []) as Report[])
    setParts((p.data ?? []) as PartRow[])
    setQuestions((q.data ?? []) as QuestionRow[])
    setChunks((c.data ?? []) as ChunkRow[])
    setSpend((s.data ?? []) as SpendRow[])
    setAlerts((a.data ?? []) as { day: string; total_usd: number }[])
  }, [topicId])

  useEffect(() => {
    if (isAdmin) load()
  }, [isAdmin, load])

  if (loading) return <p className="page-narrow">Loading…</p>
  if (!session) return <Navigate to="/login" replace />
  if (!isAdmin) return <p className="page-narrow">This page is for reviewers only.</p>

  const userId = session.user.id
  const approval = { reviewed: true, reviewed_by: userId, reviewed_at: new Date().toISOString() }

  const run = async (label: string, action: PromiseLike<{ error: { message: string } | null }>) => {
    const { error } = await action
    setMsg(error ? `${label} failed: ${error.message}` : `${label} done.`)
    await load()
    await Promise.all([content.reload(), catalog.reload()])
  }

  const visible = <T extends { reviewed: boolean }>(rows: T[]) => (showAll ? rows : rows.filter((r) => !r.reviewed))

  const embedAll = async () => {
    let done = 0
    for (;;) {
      setMsg(`Embedding… ${done} done so far`)
      const res = await callFunction<{ embedded: number; remaining: number }>('embed-chunks')
      if (!res.ok) return setMsg(`${res.message} (${done} embedded before the error)`)
      done += res.data.embedded
      if (!res.data.remaining || !res.data.embedded) return setMsg(`Embedded ${done}. ${res.data.remaining} left.`)
    }
  }

  return (
    <section className="admin">
      <h1>Reviewer</h1>
      <p className="hint">
        Only approved items show as “Verified.” Editing text sends an item back to draft, so save your edit, then
        approve.
      </p>
      <div className="row">
        <label className="checkbox">
          <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} /> Show approved items
          too
        </label>
        <button type="button" className="secondary small" onClick={embedAll}>
          Embed new content for the tutor
        </button>
        <button
          type="button"
          className="secondary small"
          onClick={async () => {
            await navigator.clipboard.writeText(session.access_token)
            setMsg('Eval token copied. It expires in about an hour.')
          }}
        >
          Copy eval token
        </button>
      </div>
      {msg && <p className="feedback">{msg}</p>}

      <label className="stack topic-filter">
        <span className="small">Topic to review</span>
        <select value={topicId} onChange={(e) => setTopicId(e.target.value)}>
          {catalog.sections.map((sec) => (
            <optgroup key={sec.id} label={sec.name}>
              {catalog.topicsIn(sec.id).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <h2>Reports ({reports.length} open)</h2>
      {reports.length === 0 && <p className="small">No open reports.</p>}
      {reports.map((r) => (
        <div key={r.id} className="card">
          <p className="small">
            {r.target_type} {r.target_id ?? ''} · {new Date(r.created_at).toLocaleString()}
          </p>
          <pre className="shown">{r.text_shown}</pre>
          {r.note && (
            <p>
              <strong>Note:</strong> {r.note}
            </p>
          )}
          <div className="row">
            <button
              type="button"
              onClick={() => run('Resolve', supabase.from('reports').update({ status: 'resolved' }).eq('id', r.id))}
            >
              Resolved (fixed)
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => run('Dismiss', supabase.from('reports').update({ status: 'dismissed' }).eq('id', r.id))}
            >
              Dismiss
            </button>
          </div>
        </div>
      ))}

      {parts.length > 0 && <h2>3D parts</h2>}
      {visible(parts).map((p) => (
        <EditableCard
          key={p.id + p.explanation + p.exam_pearl}
          title={p.name}
          reviewed={p.reviewed}
          fields={{ explanation: p.explanation, exam_pearl: p.exam_pearl }}
          onSave={(f) => run('Save', supabase.from('parts').update(f).eq('id', p.id))}
          onApprove={() => run('Approve', supabase.from('parts').update(approval).eq('id', p.id))}
        />
      ))}

      <h2>Quiz questions</h2>
      {visible(questions).map((q) => (
        <EditableCard
          key={q.id + q.prompt + (q.answer_explanation ?? '')}
          title={
            q.kind === 'mcq'
              ? `${q.id} · choices: ${q.choices?.map((c, i) => `${'ABCDEFGH'[i]}. ${c}`).join('  ')} → marked answer: ${'ABCDEFGH'[q.answer_index ?? 0]}`
              : `${q.id} → answer: ${content.partById(q.correct_part_id ?? '')?.name ?? q.correct_part_id}`
          }
          reviewed={q.reviewed}
          fields={
            q.kind === 'mcq'
              ? { ...(q.passage ? { passage: q.passage } : {}), prompt: q.prompt, answer_explanation: q.answer_explanation ?? '' }
              : { prompt: q.prompt }
          }
          onSave={(f) => run('Save', supabase.from('questions').update(f).eq('id', q.id))}
          onApprove={() => run('Approve', supabase.from('questions').update(approval).eq('id', q.id))}
          onReject={() => run('Reject', supabase.from('questions').delete().eq('id', q.id))}
        />
      ))}

      <h2>Tutor source passages{chunks.length === 300 ? ' (first 300)' : ''}</h2>
      {visible(chunks).map((c) => (
        <EditableCard
          key={c.id + c.body}
          title={`${c.title} · ${c.source_name} · ${c.license}`}
          reviewed={c.reviewed}
          fields={{ body: c.body }}
          onSave={(f) => run('Save', supabase.from('content_chunks').update(f).eq('id', c.id))}
          onApprove={() => run('Approve', supabase.from('content_chunks').update(approval).eq('id', c.id))}
          onReject={() => run('Reject', supabase.from('content_chunks').delete().eq('id', c.id))}
        />
      ))}

      <h2>AI spend (estimated)</h2>
      {alerts.length > 0 && (
        <p className="error">
          Spend alarm tripped on: {alerts.map((a) => `${a.day} ($${Number(a.total_usd).toFixed(2)})`).join(', ')}
        </p>
      )}
      {spend.length === 0 ? (
        <p className="small">No tutor usage yet.</p>
      ) : (
        <table className="weak">
          <thead>
            <tr>
              <th>Day</th>
              <th>Model</th>
              <th>Replies</th>
              <th>Cost</th>
            </tr>
          </thead>
          <tbody>
            {spend.map((s) => (
              <tr key={s.day + s.model}>
                <td>{s.day}</td>
                <td>{s.model}</td>
                <td>{s.replies}</td>
                <td>${Number(s.cost_usd).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

type CardProps = {
  title: string
  reviewed: boolean
  fields: Record<string, string>
  onSave: (fields: Record<string, string>) => void
  onApprove: () => void
  onReject?: () => void
}

function EditableCard({ title, reviewed, fields, onSave, onApprove, onReject }: CardProps) {
  const [draft, setDraft] = useState(fields)
  const dirty = Object.keys(fields).some((k) => draft[k] !== fields[k])

  return (
    <div className="card">
      <div className="part-head">
        <strong>{title}</strong>
        <span className={`badge ${reviewed ? 'verified' : 'draft'}`}>{reviewed ? 'Verified' : 'Draft'}</span>
      </div>
      {Object.keys(fields).map((k) => (
        <label key={k} className="stack">
          <span className="small">{k.replaceAll('_', ' ')}</span>
          <textarea rows={3} value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} />
        </label>
      ))}
      <div className="row">
        {dirty ? (
          <button type="button" onClick={() => onSave(draft)}>
            Save edit
          </button>
        ) : (
          !reviewed && (
            <button type="button" onClick={onApprove}>
              Approve
            </button>
          )
        )}
        {onReject && (
          <button
            type="button"
            className="secondary danger"
            onClick={() => window.confirm('Delete this item?') && onReject()}
          >
            Reject
          </button>
        )}
      </div>
    </div>
  )
}
