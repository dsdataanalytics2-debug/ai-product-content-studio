import { AppError, ERROR_MESSAGES } from './errors'

/**
 * Models wrap JSON in fences, add a preamble, or trail a sentence of commentary
 * even when told not to. This recovers the object rather than failing the whole
 * generation over punctuation.
 *
 * Note we do NOT use an assistant prefill of `{` to force the shape — prefills
 * return a 400 on every current Claude model. The Claude path uses structured
 * outputs instead (see aiService); this parser is the safety net for that and
 * the only mechanism for providers without schema enforcement.
 */
export function parseAiJson(raw) {
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new AppError('PARSE_FAILED', 'The model returned an empty response.')
  }

  const text = raw.trim()
  const candidates = [text]

  // ```json … ``` or bare ``` … ```
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced) candidates.push(fenced[1].trim())

  // Widest brace/bracket span — survives a preamble and trailing commentary.
  for (const [open, close] of [
    ['{', '}'],
    ['[', ']'],
  ]) {
    const start = text.indexOf(open)
    const end = text.lastIndexOf(close)
    if (start !== -1 && end > start) candidates.push(text.slice(start, end + 1))
  }

  for (const candidate of candidates) {
    for (const attempt of [candidate, repairJson(candidate)]) {
      try {
        const parsed = JSON.parse(attempt)
        if (parsed && typeof parsed === 'object') return parsed
      } catch {
        // Try the next candidate.
      }
    }
  }

  throw new AppError('PARSE_FAILED', ERROR_MESSAGES.PARSE_FAILED.body, {
    rawPreview: text.slice(0, 500),
  })
}

/**
 * Two repairs only, both safe: strip trailing commas, and strip control
 * characters that are illegal inside JSON strings. Anything more aggressive
 * risks silently changing Bengali content, which is worse than a clean failure.
 */
function repairJson(text) {
  const withoutTrailingCommas = text.replace(/,(\s*[}\]])/g, '$1')

  // A char-code filter rather than a regex containing literal control bytes —
  // those bytes do not survive copy-paste or an editor's whitespace cleanup.
  // Tab, newline and carriage return are legal JSON whitespace, so keep them.
  let out = ''
  for (const ch of withoutTrailingCommas) {
    const code = ch.codePointAt(0)
    if (code > 0x1f || code === 0x09 || code === 0x0a || code === 0x0d) out += ch
  }
  return out
}

/**
 * Validates and normalises a parsed script into a ScriptRecord's `script`.
 * The model can satisfy the schema and still be wrong about arithmetic, so
 * durations are rescaled here rather than trusted.
 */
export function normaliseScript(parsed, { durationSeconds } = {}) {
  if (!parsed || typeof parsed !== 'object')
    throw new AppError('PARSE_FAILED', 'Response was not a JSON object.')

  const scenes = Array.isArray(parsed.scenes) ? parsed.scenes : []
  if (scenes.length === 0) throw new AppError('PARSE_FAILED', 'Response contained no scenes.')

  const clean = scenes.map((s, i) => ({
    title: str(s?.title) || `Scene ${i + 1}`,
    duration_seconds: num(s?.duration_seconds, 5),
    voiceover: str(s?.voiceover),
    on_screen_text: str(s?.on_screen_text),
    visual_direction: str(s?.visual_direction),
    mood: str(s?.mood) || 'neutral',
    transition: str(s?.transition) || 'cut',
  }))

  // Rescale so scene durations sum to the requested length. Models routinely
  // miss this by 10-20% even with the target stated in the prompt, and a
  // timeline that does not add up makes every downstream timing wrong.
  if (durationSeconds) {
    const total = clean.reduce((sum, s) => sum + s.duration_seconds, 0)
    if (total > 0 && Math.abs(total - durationSeconds) > 1) {
      const factor = durationSeconds / total
      clean.forEach((s) => {
        s.duration_seconds = Math.max(1, Math.round(s.duration_seconds * factor))
      })
      // Absorb rounding drift in the last scene so the sum is exact.
      const drift = durationSeconds - clean.reduce((sum, s) => sum + s.duration_seconds, 0)
      const last = clean[clean.length - 1]
      last.duration_seconds = Math.max(1, last.duration_seconds + drift)
    }
  }

  return {
    title: str(parsed.title) || 'Untitled script',
    hook: str(parsed.hook),
    scenes: clean,
    cta: str(parsed.cta),
    claims_used: arr(parsed.claims_used),
    hashtags: arr(parsed.hashtags),
  }
}

const str = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v))
const num = (v, fallback) => (Number.isFinite(Number(v)) ? Number(v) : fallback)
const arr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [])
