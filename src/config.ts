export const APP_NAME = 'MedAi'
export const EXAM = 'MCAT'

// Display only. The real price lives in Stripe; limits are enforced server-side in the tutor function.
export const PAID_PRICE_USD_PER_MONTH = 20
export const FREE_TUTOR_REPLIES_TOTAL = 20
export const PAID_TUTOR_REPLIES_PER_DAY = 75

export const SECTION_ICONS: Record<string, string> = { bb: '🧬', cp: '⚗️', ps: '🧠', cars: '📖' }
export const SECTION_COLORS: Record<string, string> = {
  bb: 'var(--sec-bb)',
  cp: 'var(--sec-cp)',
  ps: 'var(--sec-ps)',
  cars: 'var(--sec-cars)',
}

export const DAILY_GOAL = 20
export const ROUND_SIZE = 10
export const WARMUP_SIZE = 5
