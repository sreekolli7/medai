import { useEffect, useState, type CSSProperties } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import { APP_NAME, DAILY_GOAL, EXAM, SECTION_COLORS, SECTION_ICONS, WARMUP_SIZE } from '../config'
import { pct, useActivity } from '../lib/activity'
import { useAuth } from '../lib/auth'
import { useCatalog } from '../lib/catalog'
import { isDue, loadQuestionSrs, loadSrs } from '../lib/srs'

const CHOICES = [
  { to: '/practice', icon: '✅', color: 'var(--accent)', title: 'Practice questions', body: 'Pick a topic and answer short rounds of questions with instant explanations.' },
  { to: '/tutor', icon: '💬', color: 'var(--sec-cp)', title: 'Ask the tutor', body: 'Stuck on something? Ask in plain words and get an answer with sources.' },
  { to: '/anatomy', icon: '🫀', color: 'var(--sec-ps)', title: '3D anatomy', body: 'Spin a 3D heart, tap any part, and hear what it does.' },
  { to: '/progress', icon: '🎯', color: 'var(--sec-bb)', title: 'My progress', body: 'See your weakest topics and what’s due for review.' },
]

// Public AAMC exam format. Check aamc.org for the latest details.
const SECTION_FACTS = [
  { id: 'bb', name: 'Bio/Biochem', detail: '59 questions · 95 min', what: 'Cells, genetics, metabolism, organ systems' },
  { id: 'cp', name: 'Chem/Phys', detail: '59 questions · 95 min', what: 'General and organic chemistry, physics, lab skills' },
  { id: 'ps', name: 'Psych/Soc', detail: '59 questions · 95 min', what: 'Behavior, the mind, society and health' },
  { id: 'cars', name: 'CARS', detail: '53 questions · 90 min', what: 'Reading passages and reasoning. No outside knowledge needed' },
]

const WELCOME_KEY = 'welcomed'

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

function Welcome({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title" onClick={(e) => e.stopPropagation()}>
        <p className="eyebrow">Welcome to {APP_NAME}</p>
        <h2 id="welcome-title">Study for the {EXAM}, one small step at a time</h2>
        <ol className="welcome-steps">
          <li>
            <span className="step-dot">1</span>
            <span>
              <strong>Pick a topic.</strong> Everything is split into bite-sized topics across all four MCAT sections.
            </span>
          </li>
          <li>
            <span className="step-dot">2</span>
            <span>
              <strong>Answer a short round.</strong> 10 questions, each with an explanation right after you answer.
            </span>
          </li>
          <li>
            <span className="step-dot">3</span>
            <span>
              <strong>We bring back what you miss.</strong> Missed questions return right before you'd forget them.
            </span>
          </li>
        </ol>
        <div className="row">
          <Link to="/practice/warmup" className="button big" onClick={onClose}>
            Try a {WARMUP_SIZE}-question warm-up
          </Link>
          <button type="button" className="secondary big" onClick={onClose}>
            Look around first
          </button>
        </div>
      </div>
    </div>
  )
}

export function HomePage() {
  const { search } = useLocation()
  const { session } = useAuth()
  const { sections } = useCatalog()
  const activity = useActivity()
  const userId = session?.user.id
  const [due, setDue] = useState({ questions: 0, parts: 0 })
  const [showWelcome, setShowWelcome] = useState(() => !localStorage.getItem(WELCOME_KEY))

  useEffect(() => {
    if (!userId) return
    Promise.all([loadQuestionSrs(), loadSrs()]).then(([q, p]) =>
      setDue({ questions: q.filter(isDue).length, parts: p.filter(isDue).length }),
    )
  }, [userId])

  // Older links (/?part=…) open the part in 3D anatomy.
  const part = new URLSearchParams(search).get('part')
  if (part) return <Navigate to={`/anatomy/heart/learn?part=${part}`} replace />

  const closeWelcome = () => {
    localStorage.setItem(WELCOME_KEY, '1')
    setShowWelcome(false)
  }

  const dueTotal = due.questions + due.parts
  const name = session?.user.user_metadata?.full_name?.split(' ')[0]
  const goalPct = activity ? Math.min(100, Math.round((activity.today / DAILY_GOAL) * 100)) : 0

  return (
    <section className="home">
      {showWelcome && <Welcome onClose={closeWelcome} />}

      <div className="hero-card">
        <p className="eyebrow">{EXAM} prep · all four sections</p>
        <h1>
          {greeting()}
          {name ? `, ${name}` : ''} 👋
        </h1>
        <p>
          {activity?.today
            ? `You've answered ${activity.today} question${activity.today === 1 ? '' : 's'} today. Keep it going!`
            : 'Not sure where to start? A quick warm-up takes about two minutes.'}
        </p>
        <div className="hero-actions">
          <Link to="/practice/warmup" className="button big light">
            ⚡ {WARMUP_SIZE}-question warm-up
          </Link>
          <Link to="/practice" className="button big glass">
            Pick a topic
          </Link>
        </div>
      </div>

      {activity ? (
        <div className="goal-row">
          <div className="goal-card">
            <div className="ring" style={{ '--p': goalPct } as CSSProperties}>
              {Math.min(activity.today, DAILY_GOAL)}
            </div>
            <div>
              <strong>Daily goal</strong>
              <span className="small">
                {activity.today >= DAILY_GOAL ? 'Done for today. Nice work! 🎉' : `${activity.today} of ${DAILY_GOAL} questions today`}
              </span>
            </div>
          </div>
          <div className="goal-card">
            <span className="flame" aria-hidden="true">
              {activity.streakDays ? '🔥' : '🌱'}
            </span>
            <div>
              <strong>
                {activity.streakDays} day{activity.streakDays === 1 ? '' : 's'}
              </strong>
              <span className="small">{activity.streakDays ? 'study streak' : 'Answer one question to start a streak'}</span>
            </div>
          </div>
          <div className="goal-card">
            <div className="ring" style={{ '--p': pct(activity.correct, activity.total), '--c': 'var(--ok)' } as CSSProperties}>
              {pct(activity.correct, activity.total)}%
            </div>
            <div>
              <strong>Accuracy</strong>
              <span className="small">across {activity.total} answers</span>
            </div>
          </div>
        </div>
      ) : (
        !session && (
          <div className="goal-row">
            <div className="goal-card">
              <span className="flame" aria-hidden="true">
                🌱
              </span>
              <div>
                <strong>Track streaks and progress</strong>
                <span className="small">
                  <Link to="/login">Sign in for free</Link> to save your answers and get review reminders.
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {dueTotal > 0 && (
        <Link to={due.questions ? '/practice/review' : '/anatomy/heart/quiz'} className="due-banner">
          <span>
            🔁 <strong>{dueTotal}</strong> item{dueTotal === 1 ? ' is' : 's are'} due for review
          </span>
          <span>Review now →</span>
        </Link>
      )}

      <h2 className="home-section-title">What do you want to do?</h2>
      <div className="choices-grid">
        {CHOICES.map((c) => (
          <Link key={c.to} to={c.to} className="choice-card" style={{ '--c': c.color } as CSSProperties}>
            <span className="choice-icon" aria-hidden="true">
              {c.icon}
            </span>
            <span>
              <span className="choice-title">{c.title}</span>
              <span className="choice-body">{c.body}</span>
            </span>
          </Link>
        ))}
      </div>

      {sections.length > 0 && (
        <>
          <h2 className="home-section-title">Jump to a section</h2>
          <div className="section-chips">
            {sections.map((s) => (
              <Link key={s.id} to={`/practice/${s.id}`} className="chip" style={{ '--c': SECTION_COLORS[s.id] } as CSSProperties}>
                <span aria-hidden="true">{SECTION_ICONS[s.id]}</span> {s.short_name}
              </Link>
            ))}
          </div>
        </>
      )}

      <details className="explainer">
        <summary>
          <span aria-hidden="true">🧭</span> New to the {EXAM}? Start here
        </summary>
        <div className="explainer-body">
          <p>
            The {EXAM} has four sections. Each is scored from 118 to 132, for a total of 472 to 528. Test day takes about
            7.5 hours with breaks.
          </p>
          <div className="section-facts">
            {SECTION_FACTS.map((f) => (
              <div key={f.id} style={{ '--c': SECTION_COLORS[f.id] } as CSSProperties}>
                <strong>
                  {SECTION_ICONS[f.id]} {f.name}
                </strong>
                <span className="small">{f.detail}</span>
                <p className="small">{f.what}</p>
              </div>
            ))}
          </div>
          <p>
            <strong>A simple plan:</strong> do a warm-up, then one topic a day. When something is due for review, do that
            first. Use the tutor whenever an explanation doesn't click.
          </p>
          <p className="small">
            Exam details are from the AAMC. Always check{' '}
            <a href="https://students-residents.aamc.org/mcat" target="_blank" rel="noreferrer">
              aamc.org
            </a>{' '}
            for the latest.
          </p>
        </div>
      </details>

      <p className="home-foot">
        <Link to="/about">How {APP_NAME} works</Link>
        {!session && (
          <>
            {' '}
            · <Link to="/login">Sign in</Link> to save your progress
          </>
        )}
      </p>
    </section>
  )
}
