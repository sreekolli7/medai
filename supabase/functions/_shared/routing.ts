import type { ModelKey } from './config.ts'

const HARD_PATTERNS = [
  /\bwhy\b/i,
  /\bexplain/i,
  /\bcompare/i,
  /\bdifference/i,
  /\bmechanism/i,
  /\bwhat happens if\b/i,
]
const LONG_MESSAGE_WORDS = 40

export function pickModel(message: string, explainBetter = false): ModelKey {
  if (explainBetter) return 'sonnet'
  if (message.trim().split(/\s+/).length > LONG_MESSAGE_WORDS) return 'sonnet'
  if (HARD_PATTERNS.some((p) => p.test(message))) return 'sonnet'
  return 'haiku'
}
