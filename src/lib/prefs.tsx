import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { stopSpeaking } from './speech'

type Theme = 'light' | 'dark'
type View = '3d' | '2d'

type Prefs = {
  voiceOn: boolean
  setVoiceOn: (on: boolean) => void
  theme: Theme
  toggleTheme: () => void
  view: View
  setView: (view: View) => void
}

const PrefsContext = createContext<Prefs | null>(null)

function initialTheme(): Theme {
  const saved = localStorage.getItem('theme')
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [voiceOn, setVoiceOnState] = useState(() => localStorage.getItem('voiceOn') === 'true')
  const [theme, setTheme] = useState<Theme>(initialTheme)
  const [view, setViewState] = useState<View>(() => (localStorage.getItem('view') === '2d' ? '2d' : '3d'))

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  const setVoiceOn = (on: boolean) => {
    if (!on) stopSpeaking()
    localStorage.setItem('voiceOn', String(on))
    setVoiceOnState(on)
  }

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('theme', next)
    setTheme(next)
  }

  const setView = (v: View) => {
    localStorage.setItem('view', v)
    setViewState(v)
  }

  return (
    <PrefsContext.Provider value={{ voiceOn, setVoiceOn, theme, toggleTheme, view, setView }}>
      {children}
    </PrefsContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function usePrefs() {
  const ctx = useContext(PrefsContext)
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider')
  return ctx
}
