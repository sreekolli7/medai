import { Component, lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Link, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import { APP_NAME, EXAM } from './config'
import { useAuth } from './lib/auth'
import { usePrefs } from './lib/prefs'
import { supabaseConfigured } from './lib/supabase'
import { HomePage } from './pages/HomePage'
import { PracticePage } from './pages/PracticePage'

const page = <K extends string>(load: () => Promise<Record<K, () => ReactNode>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })))

const AnatomyPage = page(() => import('./pages/AnatomyPage'), 'AnatomyPage')
const TutorPage = page(() => import('./pages/StudyPage'), 'TutorPage')
const ProgressPage = page(() => import('./pages/StudyPage'), 'ProgressPage')
const LegacyStudyRedirect = page(() => import('./pages/StudyPage'), 'LegacyStudyRedirect')
const AboutPage = page(() => import('./pages/AboutPage'), 'AboutPage')
const LoginPage = page(() => import('./pages/LoginPage'), 'LoginPage')
const AccountPage = page(() => import('./pages/AccountPage'), 'AccountPage')
const AdminPage = page(() => import('./pages/AdminPage'), 'AdminPage')
const PrivacyPage = page(() => import('./pages/LegalPages'), 'PrivacyPage')
const TermsPage = page(() => import('./pages/LegalPages'), 'TermsPage')
const CreditsPage = page(() => import('./pages/LegalPages'), 'CreditsPage')

const NAV = [
  { to: '/', icon: '🏠', label: 'Home', end: true },
  { to: '/practice', icon: '✅', label: 'Practice', end: false },
  { to: '/tutor', icon: '💬', label: 'Tutor', end: false },
  { to: '/progress', icon: '🎯', label: 'Progress', end: false },
]

const TITLES: [RegExp, string][] = [
  [/^\/practice/, 'Practice'],
  [/^\/anatomy/, '3D anatomy'],
  [/^\/tutor/, 'AI tutor'],
  [/^\/progress/, 'My progress'],
  [/^\/about/, 'About'],
  [/^\/login/, 'Sign in'],
  [/^\/account/, 'Account'],
  [/^\/admin/, 'Reviewer'],
  [/^\/privacy/, 'Privacy'],
  [/^\/terms/, 'Terms'],
  [/^\/credits/, 'Credits'],
]

/** Scroll to the top and set the tab title on every page change. */
function RouteEffects() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
    const title = TITLES.find(([re]) => re.test(pathname))?.[1]
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} · ${EXAM} prep that sticks`
  }, [pathname])
  return null
}

class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(error: unknown) {
    console.error('App crashed', error)
  }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <section className="oops">
        <div className="big-emoji" aria-hidden="true">
          🩹
        </div>
        <h1>Something went wrong</h1>
        <p className="hint">Sorry about that. Reloading usually fixes it. Your progress is saved.</p>
        <button type="button" onClick={() => window.location.assign('/')}>
          Reload {APP_NAME}
        </button>
      </section>
    )
  }
}

function NotFound() {
  return (
    <section className="oops">
      <div className="big-emoji" aria-hidden="true">
        🧭
      </div>
      <h1>We couldn't find that page</h1>
      <p className="hint">The link may be old or mistyped.</p>
      <Link to="/" className="button">
        Go home
      </Link>
    </section>
  )
}

function Header() {
  const { session, isAdmin } = useAuth()
  const { voiceOn, setVoiceOn, theme, toggleTheme } = usePrefs()

  return (
    <header className="header">
      <Link to="/" className="brand" aria-label={`${APP_NAME} home`}>
        <span className="logo" aria-hidden="true">
          ✚
        </span>
        {APP_NAME}
        <span className="exam">{EXAM}</span>
      </Link>
      <nav className="header-nav" aria-label="Main">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}>
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="header-actions">
        <button
          type="button"
          className={voiceOn ? 'voice on' : 'voice'}
          aria-pressed={voiceOn}
          aria-label={voiceOn ? 'Turn voice off' : 'Turn voice on'}
          title="Read questions and explanations aloud"
          onClick={() => setVoiceOn(!voiceOn)}
        >
          <span aria-hidden="true">{voiceOn ? '🔊' : '🔇'}</span>
          <span className="voice-label">{voiceOn ? 'Voice on' : 'Voice off'}</span>
        </button>
        <button
          type="button"
          className="icon"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? '☀' : '☾'}
        </button>
        {isAdmin && (
          <NavLink to="/admin" className="hide-sm">
            Review
          </NavLink>
        )}
        {session ? (
          <NavLink to="/account">Account</NavLink>
        ) : (
          <NavLink to="/login" className="button small signin">
            Sign in
          </NavLink>
        )}
      </div>
    </header>
  )
}

function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {NAV.map((n) => (
        <NavLink key={n.to} to={n.to} end={n.end}>
          <span aria-hidden="true">{n.icon}</span>
          {n.label}
        </NavLink>
      ))}
    </nav>
  )
}

function App() {
  if (!supabaseConfigured) {
    return (
      <main className="page-narrow">
        <h1>{APP_NAME}</h1>
        <p className="error">Supabase keys are missing. Add them to .env.local and restart the dev server.</p>
      </main>
    )
  }

  return (
    <div className="page">
      <RouteEffects />
      <a href="#main" className="sr-only">
        Skip to content
      </a>
      <Header />
      <main className="main" id="main">
        <ErrorBoundary>
          <Suspense fallback={<p className="hint page-narrow">Loading…</p>}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/practice" element={<PracticePage />} />
              <Route path="/practice/:section" element={<PracticePage />} />
              <Route path="/practice/:section/:topic" element={<PracticePage />} />
              <Route path="/anatomy" element={<AnatomyPage />} />
              <Route path="/anatomy/:organ" element={<AnatomyPage />} />
              <Route path="/anatomy/:organ/:mode" element={<AnatomyPage />} />
              <Route path="/tutor" element={<TutorPage />} />
              <Route path="/progress" element={<ProgressPage />} />
              <Route path="/study" element={<LegacyStudyRedirect />} />
              <Route path="/study/:mode" element={<LegacyStudyRedirect />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/account" element={<AccountPage />} />
              <Route path="/admin" element={<AdminPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/credits" element={<CreditsPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>
      <footer className="footer">
        <strong>Study tool only. Not medical advice.</strong>
        <span>
          <Link to="/about">About</Link> · <Link to="/privacy">Privacy</Link> · <Link to="/terms">Terms</Link> ·{' '}
          <Link to="/credits">Credits</Link>
        </span>
        <span>
          Not affiliated with or endorsed by the AAMC. Tutor sources include Wikipedia (CC BY-SA 4.0); 3D model from
          BodyParts3D (CC BY-SA).
        </span>
      </footer>
      <BottomNav />
    </div>
  )
}

export default App
