const num = (name: string, fallback: number) => {
  const v = Number(Deno.env.get(name))
  return Number.isFinite(v) && v > 0 ? v : fallback
}

export const EXAM = Deno.env.get('EXAM') ?? 'MCAT'

export const FREE_TUTOR_REPLIES_TOTAL = num('FREE_TUTOR_REPLIES_TOTAL', 20)
export const PAID_TUTOR_REPLIES_PER_DAY = num('PAID_TUTOR_REPLIES_PER_DAY', 75)
export const SPEND_ALERT_USD_PER_DAY = num('SPEND_ALERT_USD_PER_DAY', 5)
export const IP_REQUESTS_PER_MINUTE = num('IP_REQUESTS_PER_MINUTE', 20)

// Until a reviewer exists, retrieval may use draft chunks (citations are labelled "Draft").
export const REQUIRE_REVIEWED_SOURCES = Deno.env.get('REQUIRE_REVIEWED_SOURCES') === 'true'

export const MODELS = {
  haiku: 'claude-haiku-5-5',
  sonnet: 'claude-sonnet-5-5',
} as const
export type ModelKey = keyof typeof MODELS

// USD per million tokens (input, output).
export const PRICES: Record<string, { input: number; output: number }> = {
  [MODELS.haiku]: { input: 0.1, output: 0.5 },
  [MODELS.sonnet]: { input: 2, output: 10 },
}

export const MAX_TOKENS: Record<ModelKey, number> = { haiku: 400, sonnet: 700 }
export const ANTHROPIC_TIMEOUT_MS = 30_000

export function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const p = PRICES[model]
  if (!p) return 0
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000
}
