import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { ReportButton } from '../components/ReportButton'
import { FREE_TUTOR_REPLIES_TOTAL } from '../config'
import { useAuth } from '../lib/auth'
import { usePrefs } from '../lib/prefs'
import { speak, stopSpeaking } from '../lib/speech'
import { callFunction } from '../lib/supabase'
import type { Citation } from '../types'

type Msg =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; citations: Citation[]; question: string }
  | { role: 'notice'; content: string; upgrade?: boolean }

const SUGGESTIONS = [
  'How does a competitive inhibitor change Km?',
  'Why is the left ventricle wall thicker?',
  'What is the bystander effect?',
  'Explain the photoelectric effect simply',
]

type TutorReply = { answer: string; model: string | null; citations: Citation[]; remaining: number | null }

export function TutorMode() {
  const { session, isPaid } = useAuth()
  const { voiceOn } = usePrefs()
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [remaining, setRemaining] = useState<number | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), [messages])
  useEffect(() => () => stopSpeaking(), [])

  if (!session) {
    return (
      <section className="panel full summary">
        <div className="big-emoji" aria-hidden="true" style={{ fontSize: '3rem' }}>
          💬
        </div>
        <h2>Ask about any MCAT topic</h2>
        <p className="hint">
          Answers come only from our study sources and show where they came from. Free accounts get{' '}
          {FREE_TUTOR_REPLIES_TOTAL} tutor replies to try it out.
        </p>
        <div className="suggestions">
          {SUGGESTIONS.map((s) => (
            <span key={s} className="chip">
              {s}
            </span>
          ))}
        </div>
        <Link className="button big" to="/login">
          Sign in free to start
        </Link>
      </section>
    )
  }

  const ask = async (question: string, explainBetter = false) => {
    if (!question.trim() || busy) return
    const history = messages
      .filter((m): m is Exclude<Msg, { role: 'notice' }> => m.role !== 'notice')
      .map((m) => ({ role: m.role, content: m.content }))
    setMessages((m) => [...m, { role: 'user', content: explainBetter ? `Explain better: ${question}` : question }])
    setInput('')
    setBusy(true)
    const res = await callFunction<TutorReply>('tutor', { message: question, history, explainBetter })
    setBusy(false)
    if (!res.ok) {
      setMessages((m) => [...m, { role: 'notice', content: res.message, upgrade: res.upgrade }])
      return
    }
    setRemaining(res.data.remaining)
    setMessages((m) => [
      ...m,
      { role: 'assistant', content: res.data.answer, citations: res.data.citations, question },
    ])
    if (voiceOn) speak(res.data.answer)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    ask(input)
  }

  return (
    <section className="panel full tutor">
      <div className="part-head">
        <p className="hint">
          Answers come only from MedAi's study sources (Wikipedia articles and our own notes). If they don't cover it, the
          tutor will say so.
        </p>
        {remaining !== null && (
          <span className="small">
            {remaining} {isPaid ? 'replies left today' : 'free replies left'}
          </span>
        )}
      </div>
      <div className="chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <p>Ask anything in your own words. Not sure what to ask? Tap one:</p>
            <div className="suggestions">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" disabled={busy} onClick={() => ask(s)}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="bubble user">
              {m.content}
            </div>
          ) : m.role === 'notice' ? (
            <div key={i} className="bubble notice">
              {m.content}{' '}
              {m.upgrade && (
                <Link to="/account" className="button small">
                  Upgrade
                </Link>
              )}
            </div>
          ) : (
            <div key={i} className="bubble assistant">
              <p className="answer">{m.content}</p>
              {m.citations.length > 0 && (
                <div className="citations">
                  <span className="small">Sources:</span>
                  <ul>
                    {m.citations.map((c) => (
                      <li key={c.id}>
                        {c.source_url?.startsWith('/') ? (
                          <Link to={c.source_url}>{c.title}</Link>
                        ) : c.source_url ? (
                          <a href={c.source_url} target="_blank" rel="noreferrer">
                            {c.title}
                          </a>
                        ) : (
                          c.title
                        )}{' '}
                        <span className="small">({c.source_name})</span>{' '}
                        <span className={`badge ${c.reviewed ? 'verified' : 'draft'}`}>
                          {c.reviewed ? 'Verified' : 'Draft'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="row">
                <button type="button" className="secondary small" disabled={busy} onClick={() => ask(m.question, true)}>
                  Explain better
                </button>
                <button type="button" className="secondary small" onClick={() => speak(m.content)}>
                  🔊 Listen
                </button>
              </div>
              <ReportButton targetType="tutor_answer" textShown={`Q: ${m.question}\nA: ${m.content}`} />
            </div>
          ),
        )}
        {busy && <div className="bubble assistant thinking">Thinking…</div>}
        <div ref={endRef} />
      </div>

      <form className="ask" onSubmit={submit}>
        <label htmlFor="tutor-input" className="sr-only">
          Your question
        </label>
        <input
          id="tutor-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask any MCAT question…"
          maxLength={2000}
          autoComplete="off"
        />
        <button type="submit" disabled={busy || !input.trim()}>
          Ask
        </button>
      </form>
    </section>
  )
}
