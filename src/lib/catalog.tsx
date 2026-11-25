import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Section, Topic } from '../types'
import { supabase } from './supabase'

type CatalogState = {
  sections: Section[]
  topics: Topic[]
  questionCounts: Record<string, number>
  loading: boolean
  error: string | null
  topicsIn: (sectionId: string) => Topic[]
  sectionById: (id: string) => Section | undefined
  topicById: (id: string) => Topic | undefined
  reload: () => Promise<void>
}

const CatalogContext = createContext<CatalogState | null>(null)

/** MCAT sections and topics, plus how many practice questions each topic has. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const [sections, setSections] = useState<Section[]>([])
  const [topics, setTopics] = useState<Topic[]>([])
  const [questionCounts, setQuestionCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reload = useCallback(async () => {
    const [s, t, stats] = await Promise.all([
      supabase.from('sections').select('id, name, short_name, sort_order').order('sort_order'),
      supabase.from('topics').select('id, section_id, name, blurb, sort_order, has_model').order('sort_order'),
      supabase.from('topic_stats').select('topic_id, mcq_count'),
    ])
    if (s.error || t.error) {
      setError("Couldn't load the MCAT topics. Try refreshing.")
      setLoading(false)
      return
    }
    setSections((s.data ?? []) as Section[])
    setTopics((t.data ?? []) as Topic[])
    setQuestionCounts(Object.fromEntries((stats.data ?? []).map((r) => [r.topic_id, Number(r.mcq_count)])))
    setError(null)
    setLoading(false)
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const topicsIn = useCallback((sectionId: string) => topics.filter((t) => t.section_id === sectionId), [topics])
  const sectionById = useCallback((id: string) => sections.find((s) => s.id === id), [sections])
  const topicById = useCallback((id: string) => topics.find((t) => t.id === id), [topics])

  return (
    <CatalogContext.Provider
      value={{ sections, topics, questionCounts, loading, error, topicsIn, sectionById, topicById, reload }}
    >
      {children}
    </CatalogContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCatalog() {
  const ctx = useContext(CatalogContext)
  if (!ctx) throw new Error('useCatalog must be used inside CatalogProvider')
  return ctx
}
