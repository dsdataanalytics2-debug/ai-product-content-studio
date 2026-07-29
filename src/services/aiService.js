import Anthropic from '@anthropic-ai/sdk'
import { PROVIDERS, PROVIDER_ORDER, defaultModelFor } from '../config/models'
import { AppError, classifyHttpError, toAppError } from '../utils/errors'
import { parseAiJson } from '../utils/parseAiJson'
import { estimateCost } from '../config/pricing'
import { useApiStore } from '../store/useApiStore'
import { useSettingsStore, debug } from '../store/useSettingsStore'

/**
 * One entry point — `generate()` — that takes a system prompt, a user prompt,
 * and optionally a JSON schema, and returns { text, json, provider, model,
 * usage, cost }. Every caller in the app goes through it, so provider fallback,
 * debug logging, and cost accounting exist exactly once.
 *
 * Two things here are load-bearing and easy to get wrong:
 *
 * 1. NO ASSISTANT PREFILL. The plan's Appendix I suggests prefilling `{` to
 *    force JSON out of Claude. That advice predates the current models: a
 *    trailing assistant turn returns HTTP 400 on Opus 5 and the whole 4.6+
 *    family. We use structured outputs (`output_config.format`) instead, which
 *    is both supported and stronger — the shape is enforced, not encouraged.
 *
 * 2. NO SAMPLING PARAMETERS. `temperature`, `top_p` and `top_k` are removed on
 *    current Claude models and return 400. Tone is steered by the prompt, which
 *    is what Appendix D is for.
 */

const MAX_TOKENS = 8192 // non-streaming; comfortably under the SDK's HTTP timeout

// ── Claude ──────────────────────────────────────────────────────────────────

function claudeClient(apiKey) {
  return new Anthropic({
    apiKey,
    // Mode A runs entirely in the browser with the user's own key. The SDK
    // requires this acknowledgement, and also sets the
    // anthropic-dangerous-direct-browser-access header that makes the
    // preflight succeed (Appendix I).
    dangerouslyAllowBrowser: true,
  })
}

async function callClaude({ apiKey, model, system, prompt, schema, signal }) {
  const client = claudeClient(apiKey)

  const response = await client.messages.create(
    {
      model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: prompt }],
      // Effort replaces the old thinking-budget concept. Thinking is on by
      // default on Opus 5, and max_tokens caps thinking + text together, which
      // is why MAX_TOKENS is generous relative to the output we need.
      output_config: {
        effort: useSettingsStore.getState().effort,
        ...(schema ? { format: { type: 'json_schema', schema } } : {}),
      },
    },
    { signal },
  )

  // A refusal is a successful HTTP 200 with an empty or partial content array.
  // Reading content[0] first would throw a confusing TypeError instead.
  if (response.stop_reason === 'refusal') {
    throw new AppError(
      'REFUSED',
      response.stop_details?.explanation ||
        'The provider declined this request. Rephrase the brief, or switch provider in Settings.',
      { category: response.stop_details?.category ?? null },
    )
  }

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')

  if (response.stop_reason === 'max_tokens' && !text.trim()) {
    throw new AppError('PARSE_FAILED', 'The response hit the token limit before producing text.')
  }

  return {
    text,
    usage: {
      in: response.usage.input_tokens,
      out: response.usage.output_tokens,
      cacheRead: response.usage.cache_read_input_tokens ?? 0,
    },
  }
}

// ── Gemini ──────────────────────────────────────────────────────────────────

async function callGemini({ apiKey, model, system, prompt, schema, signal }) {
  const url = `${PROVIDERS.gemini.endpoint}/${model}:generateContent`

  const res = await fetch(url, {
    method: 'POST',
    // Key in a header, never a query string — query strings land in server logs
    // and browser history (pre-ship checklist).
    headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: MAX_TOKENS,
        responseMimeType: 'application/json',
        ...(schema ? { responseSchema: toGeminiSchema(schema) } : {}),
      },
    }),
  })

  if (!res.ok) throw classifyHttpError(res.status, await safeJson(res))

  const data = await res.json()
  const candidate = data.candidates?.[0]

  if (candidate?.finishReason === 'SAFETY')
    throw new AppError('REFUSED', 'Gemini blocked this request on safety grounds.')

  const text = (candidate?.content?.parts ?? []).map((p) => p.text ?? '').join('')

  return {
    text,
    usage: {
      in: data.usageMetadata?.promptTokenCount ?? 0,
      out: data.usageMetadata?.candidatesTokenCount ?? 0,
    },
  }
}

/**
 * Gemini's schema dialect is OpenAPI-flavoured: uppercase types, and it rejects
 * `additionalProperties`. Translating here keeps one schema definition in
 * constants.js instead of a per-provider copy that will drift.
 */
function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema)
  if (!schema || typeof schema !== 'object') return schema

  const out = {}
  for (const [k, v] of Object.entries(schema)) {
    if (k === 'additionalProperties') continue
    if (k === 'type' && typeof v === 'string') {
      out.type = v.toUpperCase()
      continue
    }
    out[k] = toGeminiSchema(v)
  }
  return out
}

// ── Groq (OpenAI-compatible) ────────────────────────────────────────────────

async function callGroq({ apiKey, model, system, prompt, schema, signal }) {
  const res = await fetch(PROVIDERS.groq.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      max_tokens: MAX_TOKENS,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      ...(schema
        ? {
            response_format: {
              type: 'json_schema',
              json_schema: { name: 'script', strict: true, schema },
            },
          }
        : { response_format: { type: 'json_object' } }),
    }),
  })

  if (!res.ok) throw classifyHttpError(res.status, await safeJson(res))

  const data = await res.json()
  const choice = data.choices?.[0]

  if (choice?.finish_reason === 'content_filter')
    throw new AppError('REFUSED', 'Groq filtered this request.')

  return {
    text: choice?.message?.content ?? '',
    usage: {
      in: data.usage?.prompt_tokens ?? 0,
      out: data.usage?.completion_tokens ?? 0,
    },
  }
}

/**
 * OpenRouter — OpenAI-compatible, so this is callGroq with three differences.
 *
 * `json_schema` is requested only when a schema is given, and a failure to honour
 * it falls back to plain JSON mode: OpenRouter routes to whatever vendor hosts
 * the chosen model, and not all of them support strict schemas. Refusing the
 * whole request over that would make most of the catalogue unusable.
 *
 * The Referer/X-Title headers are optional attribution, which OpenRouter uses
 * for its public leaderboard; they cost nothing and keep requests identifiable.
 */
async function callOpenRouter({ apiKey, model, system, prompt, schema, signal }) {
  const body = (useSchema) => ({
    model,
    max_tokens: MAX_TOKENS,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: prompt },
    ],
    ...(useSchema && schema
      ? { response_format: { type: 'json_schema', json_schema: { name: 'script', strict: true, schema } } }
      : { response_format: { type: 'json_object' } }),
  })

  const send = (useSchema) =>
    fetch(PROVIDERS.openrouter.endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': window.location.origin,
        'X-Title': 'AI Product Content Studio',
      },
      signal,
      body: JSON.stringify(body(useSchema)),
    })

  let res = await send(true)

  // 400 here is nearly always "this model does not do strict schemas".
  if (res.status === 400 && schema) res = await send(false)

  if (!res.ok) throw classifyHttpError(res.status, await safeJson(res))

  const data = await res.json()

  // OpenRouter reports upstream failures in a 200 body rather than a status.
  if (data.error) throw new AppError('UNKNOWN', data.error.message ?? 'OpenRouter returned an error.')

  const choice = data.choices?.[0]
  if (choice?.finish_reason === 'content_filter')
    throw new AppError('REFUSED', 'The model filtered this request.')

  return {
    text: choice?.message?.content ?? '',
    usage: {
      in: data.usage?.prompt_tokens ?? 0,
      out: data.usage?.completion_tokens ?? 0,
    },
  }
}

const CALLERS = { claude: callClaude, gemini: callGemini, groq: callGroq, openrouter: callOpenRouter }

async function safeJson(res) {
  try {
    return await res.json()
  } catch {
    return null
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Runs a prompt against the preferred provider, falling back down the chain on
 * failure when autoFallback is on. Auth failures do not fall back — a rejected
 * key is a configuration problem the user must see, not something to paper over
 * by quietly using a different provider than they chose.
 */
export async function generate({ system, prompt, schema, json = true, signal, providerOverride }) {
  const api = useApiStore.getState()
  const settings = useSettingsStore.getState()

  const available = api.availableProviders()
  if (available.length === 0) throw new AppError('NO_KEYS')

  const preferred = providerOverride ?? settings.preferredProvider
  const chain = settings.autoFallback && !providerOverride
    ? [preferred, ...PROVIDER_ORDER.filter((p) => p !== preferred)].filter((p) =>
        available.includes(p),
      )
    : [available.includes(preferred) ? preferred : available[0]]

  let lastError = null

  for (const provider of chain) {
    // The chosen model only applies to the provider it belongs to; a fallback
    // provider uses its own default.
    const model =
      provider === preferred && settings.model?.startsWith(modelPrefix(provider))
        ? settings.model
        : defaultModelFor(provider)

    const apiKey = api.keys[PROVIDERS[provider].keyName]
    const startedAt = performance.now()

    try {
      debug.record({ provider, model, kind: 'request', system, prompt })

      const { text, usage } = await CALLERS[provider]({
        apiKey,
        model,
        system,
        prompt,
        schema,
        signal,
      })

      const ms = Math.round(performance.now() - startedAt)
      debug.record({ provider, model, kind: 'response', ms, usage, raw: text })

      const cost = estimateCost(model, usage.in, usage.out)

      return {
        provider,
        model,
        text,
        json: json ? parseAiJson(text) : null,
        usage,
        cost: cost.usd,
        ms,
      }
    } catch (err) {
      const appError = toAppError(err)
      lastError = appError

      debug.record({
        provider,
        model,
        kind: 'error',
        ms: Math.round(performance.now() - startedAt),
        error: `${appError.code}: ${appError.message}`,
      })
      // Never swallow the raw error — Appendix E's rule for every catch block.
      console.error(`[aiService] ${provider}/${model} failed`, err)

      // Don't retry the chain on a cancel or a bad key.
      if (appError.code === 'ABORTED' || appError.code === 'AUTH_FAILED') throw appError
    }
  }

  throw lastError ?? new AppError('UNKNOWN', 'All providers failed.')
}

const modelPrefix = (provider) =>
  ({ claude: 'claude', gemini: 'gemini', groq: 'openai/' })[provider] ?? ''

/**
 * A one-token round trip to prove a key works. Cheaper than a real generation
 * and specific enough to distinguish "bad key" from "no network".
 */
export async function testProvider(provider) {
  const api = useApiStore.getState()
  const apiKey = api.keys[PROVIDERS[provider].keyName]
  if (!apiKey) return { status: 'fail', message: 'No key entered.' }

  try {
    await CALLERS[provider]({
      apiKey,
      model: defaultModelFor(provider),
      system: 'Reply with the single word OK.',
      prompt: 'OK',
      schema: null,
    })
    return { status: 'ok', message: 'Key accepted.' }
  } catch (err) {
    const appError = toAppError(err)
    console.error(`[aiService] test ${provider} failed`, err)
    return { status: 'fail', message: appError.display().body }
  }
}
