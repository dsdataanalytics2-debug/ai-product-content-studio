/**
 * Model IDs + endpoints. One place, so no session invents a model string.
 *
 * The Claude path uses the official @anthropic-ai/sdk (see services/aiService).
 * Gemini and Groq are plain fetch — no browser-safe first-party SDK for either.
 */

export const PROVIDERS = {
  claude: {
    id: 'claude',
    label: 'Claude',
    emoji: '🤖',
    keyName: 'claudeKey',
    role: 'Primary AI (script generation)',
    keyHint: 'Starts with sk-ant-. Create one at console.anthropic.com.',
    docsUrl: 'https://platform.claude.com/settings/keys',
    models: [
      { id: 'claude-opus-5', label: 'Opus 5 — most capable', default: true },
      { id: 'claude-sonnet-5', label: 'Sonnet 5 — balanced' },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5 — fastest, cheapest' },
    ],
  },

  gemini: {
    id: 'gemini',
    label: 'Gemini',
    emoji: '💎',
    keyName: 'geminiKey',
    role: 'Fallback AI',
    keyHint: 'Create one at aistudio.google.com/apikey.',
    docsUrl: 'https://aistudio.google.com/apikey',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    models: [
      { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash', default: true },
      { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash Lite' },
    ],
  },

  groq: {
    id: 'groq',
    label: 'Groq',
    emoji: '⚡',
    keyName: 'groqKey',
    role: 'Fast fallback AI',
    keyHint: 'Starts with gsk_. Create one at console.groq.com/keys.',
    docsUrl: 'https://console.groq.com/keys',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions',
    models: [
      { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', default: true },
      { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B' },
    ],
  },
  /**
   * One key, many vendors. OpenRouter proxies GPT, Claude, Gemini, DeepSeek and
   * hundreds of open models behind a single OpenAI-compatible endpoint, so
   * reaching a new model is a dropdown change rather than another integration.
   *
   * The models below are a starting shortlist, not the whole catalogue — any id
   * from openrouter.ai/models works if you add it here.
   */
  openrouter: {
    id: 'openrouter',
    label: 'OpenRouter',
    emoji: '🌐',
    keyName: 'openRouterKey',
    role: 'GPT, DeepSeek and more via one key',
    keyHint: 'Starts with sk-or-v1-. Create one at openrouter.ai/keys.',
    docsUrl: 'https://openrouter.ai/keys',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    models: [
      { id: 'openai/gpt-5', label: 'GPT-5', default: true },
      { id: 'openai/gpt-5-mini', label: 'GPT-5 mini' },
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { id: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'deepseek/deepseek-chat', label: 'DeepSeek Chat' },
      { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B' },
    ],
  },
}

/** Order matters: this is the fallback chain when a provider fails. */
export const PROVIDER_ORDER = ['claude', 'gemini', 'groq', 'openrouter']

export const defaultModelFor = (provider) =>
  PROVIDERS[provider]?.models.find((m) => m.default)?.id ?? PROVIDERS[provider]?.models[0]?.id

export const ALL_MODEL_OPTIONS = PROVIDER_ORDER.flatMap((p) =>
  PROVIDERS[p].models.map((m) => ({ value: m.id, label: `${PROVIDERS[p].label} · ${m.label}` })),
)

/**
 * Voice providers. Browser TTS is the only one that works with zero setup, so
 * it is the default — a paid voice API is a nice-to-have, not a prerequisite.
 */
export const VOICE_PROVIDERS = {
  browser: {
    id: 'browser',
    label: 'Browser TTS',
    sublabel: 'Free',
    needsKey: false,
    supportsPitch: true,
  },
  elevenlabs: {
    id: 'elevenlabs',
    label: 'ElevenLabs',
    sublabel: 'Realistic',
    needsKey: true,
    keyName: 'elevenLabsKey',
    supportsPitch: false,
    endpoint: 'https://api.elevenlabs.io/v1',
  },
  googletts: {
    id: 'googletts',
    label: 'Google TTS',
    sublabel: 'Multi-language',
    needsKey: true,
    keyName: 'googleTtsKey',
    supportsPitch: true,
    endpoint: 'https://texttospeech.googleapis.com/v1/text:synthesize',
  },
}
