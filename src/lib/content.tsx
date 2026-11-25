import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Part, Question } from '../types'
import { PART_COLUMNS } from './anatomy'
import { supabase } from './supabase'

type ContentState = {
  parts: Part[]
  questions: Question[]
  loading: boolean
  error: string | null
  partById: (id: string) => Part | undefined
  reload: () => Promise<void>
}

const ContentContext = createContext<ContentState | null>(null)

/** Parts and tap-the-model questions for the heart model, which has the full learn / quiz / lesson flow. */
export function ContentProvider({ model, children }: { model: string; children: ReactNode }) {
  const [parts, setParts] = useState<Part[]>([])
  const [questions, setQuestions] = useState<Question[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const { data: partRows, error: partErr } = await supabase
      .from('parts')
      .select(PART_COLUMNS)
      .eq('model', model)
      .order('sort_order')
    if (partErr) {
      setError("Couldn't load the 3D anatomy content. Try refreshing.")
      setLoading(false)
      return
    }
    const { data: qRows } = await supabase
      .from('questions')
      .select(
        'id, topic_id, kind, passage, part_id, prompt, correct_part_id, related_part_id, choices, answer_index, answer_explanation, difficulty, reviewed, source_name, source_url, license',
      )
      .eq('topic_id', model)
      .eq('kind', 'tap')
    setParts((partRows ?? []) as Part[])
    setQuestions((qRows ?? []) as Question[])
    setError(null)
    setLoading(false)
  }, [model])

  useEffect(() => {
    reload()
  }, [reload])

  const partById = useCallback((id: string) => parts.find((p) => p.id === id), [parts])

  return (
    <ContentContext.Provider value={{ parts, questions, loading, error, partById, reload }}>
      {children}
    </ContentContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useContent() {
  const ctx = useContext(ContentContext)
  if (!ctx) throw new Error('useContent must be used inside ContentProvider')
  return ctx
}
