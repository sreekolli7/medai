export type Section = { id: string; name: string; short_name: string; sort_order: number }

export type Topic = {
  id: string
  section_id: string
  name: string
  blurb: string
  sort_order: number
  has_model: boolean
}

export type Part = {
  id: string
  model: string
  topic_id: string
  name: string
  side: 'left' | 'right' | null
  blood: 'oxygen-poor' | 'oxygen-rich' | null
  sort_order: number
  explanation: string
  exam_pearl: string
  audio_url: string | null
  reviewed: boolean
  reviewed_at: string | null
}

export type Question = {
  id: string
  topic_id: string
  kind: 'tap' | 'mcq'
  passage: string | null
  part_id: string | null
  prompt: string
  correct_part_id: string | null
  related_part_id: string | null
  choices: string[] | null
  answer_index: number | null
  answer_explanation: string | null
  difficulty: number
  reviewed: boolean
  source_name: string | null
  source_url: string | null
  license: string | null
}

export type SrsRow = {
  part_id: string
  misses: number
  correct_streak: number
  interval_days: number
  due_at: string
}

export type QuestionSrsRow = {
  question_id: string
  misses: number
  correct_streak: number
  interval_days: number
  due_at: string
}

export type Citation = {
  id: number
  title: string
  source_name: string
  source_url: string | null
  reviewed: boolean
}

export type ReportTarget = 'part' | 'question' | 'tutor_answer' | 'chunk'
