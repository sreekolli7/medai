import { useState, type CSSProperties } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { ScreenHead } from '../components/ScreenHead'
import { SECTION_COLORS, SECTION_ICONS, WARMUP_SIZE } from '../config'
import { pct, useActivity, type Activity } from '../lib/activity'
import { modelForTopic } from '../lib/anatomy'
import { useAuth } from '../lib/auth'
import { useCatalog } from '../lib/catalog'
import { McqQuiz } from '../modes/McqQuiz'

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function sum(activity: Activity | null, ids: string[]) {
  let total = 0
  let correct = 0
  for (const id of ids) {
    total += activity?.byTopic[id]?.total ?? 0
    correct += activity?.byTopic[id]?.correct ?? 0
  }
  return { total, correct }
}

function TopicProgress({ total, correct }: { total: number; correct: number }) {
  if (!total) return <span className="topic-progress">Not started yet</span>
  const p = pct(correct, total)
  return (
    <span className="topic-progress">
      <span className="meter" aria-hidden="true">
        <span style={{ width: `${p}%` }} />
      </span>
      {p}% right · {plural(total, 'answer')}
    </span>
  )
}

/** /practice → pick a section, /practice/:section → pick a topic, /practice/:section/:topic → quiz. */
export function PracticePage() {
  const { section: sectionId, topic: topicId } = useParams()
  const { session } = useAuth()
  const { sections, topics: allTopics, topicsIn, sectionById, topicById, questionCounts, loading, error } = useCatalog()
  const activity = useActivity()
  const [filter, setFilter] = useState('')

  if (loading) return <p className="panel full">Loading topics…</p>
  if (error) return <p className="panel full error">{error}</p>

  if (sectionId === 'review') {
    return (
      <div className="study">
        <ScreenHead back="/" backLabel="Home" icon="🔁" title="Due for review" />
        <McqQuiz topicIds={[]} onlyDue />
      </div>
    )
  }

  if (sectionId === 'warmup') {
    return (
      <div className="study">
        <ScreenHead back="/" backLabel="Home" icon="⚡" title={`${WARMUP_SIZE}-question warm-up`}>
          <span className="small">A quick mix from every section</span>
        </ScreenHead>
        <McqQuiz topicIds={allTopics.map((t) => t.id)} roundSize={WARMUP_SIZE} />
      </div>
    )
  }

  const count = (ids: string[]) => ids.reduce((n, id) => n + (questionCounts[id] ?? 0), 0)

  if (!sectionId) {
    return (
      <div className="study">
        <ScreenHead back="/" backLabel="Home" icon="✅" title="Practice questions" />
        <p className="lead">
          Pick a section to see its topics. New here? Try the <Link to="/practice/warmup">{WARMUP_SIZE}-question warm-up</Link>{' '}
          first.
        </p>
        <div className="choices-grid">
          {session && (
            <Link to="/practice/review" className="choice-card" style={{ '--c': 'var(--fire)' } as CSSProperties}>
              <span className="choice-icon" aria-hidden="true">
                🔁
              </span>
              <span>
                <span className="choice-title">Due for review</span>
                <span className="choice-body">Questions you missed come back here when they're due.</span>
              </span>
            </Link>
          )}
          {sections.map((s) => {
            const ids = topicsIn(s.id).map((t) => t.id)
            const stats = sum(activity, ids)
            return (
              <Link key={s.id} to={`/practice/${s.id}`} className="choice-card" style={{ '--c': SECTION_COLORS[s.id] } as CSSProperties}>
                <span className="choice-icon" aria-hidden="true">
                  {SECTION_ICONS[s.id]}
                </span>
                <span style={{ flex: 1 }}>
                  <span className="choice-title">{s.name}</span>
                  <span className="choice-body">
                    {s.short_name} · {plural(ids.length, 'topic')} · {plural(count(ids), 'question')}
                  </span>
                  {activity && <TopicProgress {...stats} />}
                </span>
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  const section = sectionById(sectionId)
  if (!section) return <Navigate to="/practice" replace />
  const topics = topicsIn(section.id)
  const icon = SECTION_ICONS[section.id]
  const color = { '--c': SECTION_COLORS[section.id] } as CSSProperties

  if (!topicId) {
    const q = filter.trim().toLowerCase()
    const shown = q ? topics.filter((t) => `${t.name} ${t.blurb ?? ''}`.toLowerCase().includes(q)) : topics
    return (
      <div className="study">
        <ScreenHead back="/practice" backLabel="Sections" icon={icon} title={section.name} />
        <p className="lead">Pick a topic, or mix them all together.</p>
        {topics.length > 6 && (
          <input
            className="topic-filter"
            type="search"
            placeholder="Search topics…"
            aria-label="Search topics"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        )}
        <div className="topic-list">
          {topics.length > 1 && !q && (
            <Link to={`/practice/${section.id}/all`} className="topic-row mixed" style={color}>
              <span>
                <span className="choice-title">🔀 All {section.short_name} topics</span>
                <span className="choice-body">A mix from every topic in this section</span>
              </span>
              <span className="count">{plural(count(topics.map((t) => t.id)), 'question')}</span>
            </Link>
          )}
          {shown.map((t) => (
            <Link key={t.id} to={`/practice/${section.id}/${t.id}`} className="topic-row" style={color}>
              <span>
                <span className="choice-title">
                  {t.name} {t.has_model && <span className="tag">3D</span>}
                </span>
                <span className="choice-body">{t.blurb}</span>
              </span>
              <span className="count">{plural(questionCounts[t.id] ?? 0, 'question')}</span>
              {activity && <TopicProgress {...sum(activity, [t.id])} />}
            </Link>
          ))}
          {shown.length === 0 && <p className="hint">No topics match “{filter}”.</p>}
        </div>
      </div>
    )
  }

  const topic = topicId === 'all' ? null : topicById(topicId)
  const model = topic ? modelForTopic(topic.id) : undefined
  if (topicId !== 'all' && (!topic || topic.section_id !== section.id)) return <Navigate to={`/practice/${section.id}`} replace />

  return (
    <div className="study">
      <ScreenHead
        back={`/practice/${section.id}`}
        backLabel={section.short_name}
        icon={icon}
        title={topic ? topic.name : `All ${section.short_name} topics`}
      >
        {topic && model && (
          <Link to={`/anatomy/${model.id}`} className="small">
            {model.icon} Explore it in 3D →
          </Link>
        )}
      </ScreenHead>
      <McqQuiz
        key={topicId}
        topicIds={topic ? [topic.id] : topics.map((t) => t.id)}
        backTo={`/practice/${section.id}`}
      />
    </div>
  )
}
