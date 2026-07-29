/**
 * USD per 1,000,000 tokens. VERIFY AGAINST PROVIDER PRICING PAGES BEFORE
 * TRUSTING TOTALS.
 *
 * Last checked: 2026-07-26  ← re-check quarterly
 *
 * Anthropic rates below are from Anthropic's published first-party API pricing.
 * The Gemini and Groq rows are deliberately left null: a confidently wrong cost
 * table is worse than an empty one, and the UI is built to say "not configured"
 * rather than "$0.00" when a rate is missing. Fill them in from each provider's
 * pricing page when you add the key.
 */

export const PRICING = {
  'claude-opus-5': { in: 5.0, out: 25.0 },
  'claude-sonnet-5': { in: 3.0, out: 15.0 },
  'claude-haiku-4-5': { in: 1.0, out: 5.0 },

  'gemini-3.6-flash': { in: null, out: null },
  'gemini-3.5-flash-lite': { in: null, out: null },

  'openai/gpt-oss-120b': { in: null, out: null },
  'openai/gpt-oss-20b': { in: null, out: null },

  // OpenRouter. Left unpriced deliberately: the rate depends on which upstream
  // vendor serves the request and changes often, so a hardcoded number would be
  // confidently wrong. openrouter.ai/models carries the current rates, and your
  // OpenRouter dashboard shows the real spend per request.
  'openai/gpt-5': { in: null, out: null },
  'openai/gpt-5-mini': { in: null, out: null },
  'anthropic/claude-sonnet-4.5': { in: null, out: null },
  'google/gemini-2.5-flash': { in: null, out: null },
  'deepseek/deepseek-chat': { in: null, out: null },
  'meta-llama/llama-3.3-70b-instruct': { in: null, out: null },
}

export function estimateCost(model, inTokens = 0, outTokens = 0) {
  const p = PRICING[model]
  if (!p?.in) return { usd: null, note: 'Rate not configured' }
  return { usd: (inTokens * p.in + outTokens * p.out) / 1_000_000, note: null }
}

/**
 * A 3-product, 60-second script is roughly 1,500 input and 1,200 output tokens
 * — fractions of a cent on mid-tier models. Cost tracking exists to catch a
 * runaway retry loop, not to economise on individual generations.
 */
export function formatCost(usd) {
  if (usd == null) return 'Not tracked'
  if (usd < 0.01) return `<$0.01`
  return `$${usd.toFixed(usd < 1 ? 3 : 2)}`
}
