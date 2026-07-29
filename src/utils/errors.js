/** APPENDIX E — one error class, one message map, used everywhere. */

export const ERROR_MESSAGES = {
  NO_KEYS: {
    title: 'No AI provider configured',
    body: 'Add a Claude, Gemini, or Groq key in Settings.',
    action: { label: 'Open Settings', to: '/settings' },
  },
  NO_STORE: {
    title: 'Store not connected',
    body: 'Add your WooCommerce URL, consumer key, and secret in Settings.',
    action: { label: 'Open Settings', to: '/settings' },
  },
  AUTH_FAILED: {
    title: 'Authentication failed',
    body: 'The API key was rejected (401). Check for extra spaces when pasting.',
  },
  RATE_LIMITED: {
    title: 'Rate limited',
    body: 'The provider is throttling requests. Wait a minute, or switch provider in Settings.',
  },
  CORS_BLOCKED: {
    title: 'Blocked by CORS',
    body: 'Your browser blocked the request to your store. Set up the Vite dev proxy — see README section 3.',
  },
  NETWORK: {
    title: 'Network error',
    body: 'Could not reach the server. Check your connection and that the URL includes https://.',
  },
  PARSE_FAILED: {
    title: 'Malformed AI response',
    body: 'The model returned text that is not valid JSON. Try regenerating, or switch to a different model.',
  },
  QUOTA_EXCEEDED: {
    title: 'Browser storage full',
    body: 'Delete old scripts in Library, or export a backup and clear.',
    action: { label: 'Open Library', to: '/library' },
  },
  ABORTED: { title: 'Cancelled', body: 'Generation was cancelled.' },
  REFUSED: {
    title: 'The model declined this request',
    body: 'Safety classifiers stopped the generation. Rephrase the brief, or switch provider in Settings.',
  },
  NO_PRODUCTS: {
    title: 'No products selected',
    body: 'Pick at least one product before generating a script.',
  },
  UNKNOWN: { title: 'Something went wrong', body: 'An unexpected error occurred.' },
}

export class AppError extends Error {
  constructor(code, message, meta = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.meta = meta
    this.status = meta.status ?? null
  }

  /**
   * What the UI renders. Every catch block goes through this instead of
   * formatting its own copy: `title` in the toast, `body` in the panel,
   * `action` as a button.
   */
  display() {
    const entry = ERROR_MESSAGES[this.code] ?? ERROR_MESSAGES.UNKNOWN
    return {
      code: this.code,
      title: entry.title,
      // A provider's own message is often more specific than ours (which model
      // was wrong, which field was rejected) — prefer it when we have one.
      body: this.message && this.message !== entry.body ? this.message : entry.body,
      action: entry.action ?? null,
    }
  }
}

export function classifyHttpError(status, body) {
  if (status === 401 || status === 403)
    return new AppError('AUTH_FAILED', ERROR_MESSAGES.AUTH_FAILED.body, { status })
  if (status === 429)
    return new AppError('RATE_LIMITED', ERROR_MESSAGES.RATE_LIMITED.body, { status })
  if (status === 0) return new AppError('CORS_BLOCKED', ERROR_MESSAGES.CORS_BLOCKED.body, { status })

  const providerMessage =
    body?.error?.message ?? body?.error?.[0]?.message ?? body?.message ?? `HTTP ${status}`
  return new AppError('UNKNOWN', providerMessage, { status })
}

/**
 * Normalises anything thrown into an AppError, so a catch block never has to
 * branch on error shape. Handles the Anthropic SDK's typed errors, fetch's
 * TypeError-on-network-failure, and AbortError.
 */
export function toAppError(err) {
  if (err instanceof AppError) return err

  if (err?.name === 'AbortError') return new AppError('ABORTED', ERROR_MESSAGES.ABORTED.body)

  // Anthropic SDK errors carry a numeric `status`.
  if (typeof err?.status === 'number' && err.status > 0) {
    return classifyHttpError(err.status, { error: { message: err.message } })
  }

  // fetch() rejects with a bare TypeError for both offline and CORS failures;
  // they are indistinguishable from JS, so NETWORK is the honest label.
  if (err instanceof TypeError) return new AppError('NETWORK', ERROR_MESSAGES.NETWORK.body)

  if (err?.name === 'QuotaExceededError' || /quota/i.test(err?.message ?? ''))
    return new AppError('QUOTA_EXCEEDED', ERROR_MESSAGES.QUOTA_EXCEEDED.body)

  return new AppError('UNKNOWN', err?.message ?? String(err))
}
