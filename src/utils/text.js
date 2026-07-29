/** stripHtml, wordCount, truncate — plus the Bengali-safe helpers. */

export function stripHtml(html = '') {
  if (!html) return ''
  // DOMParser rather than a regex: WooCommerce descriptions contain real markup,
  // entities, and the occasional stray script tag.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim()
}

export function wordCount(text = '') {
  const trimmed = text.trim()
  return trimmed ? trimmed.split(/\s+/).length : 0
}

export function truncate(text = '', max = 400) {
  const clean = stripHtml(text)
  if (clean.length <= max) return clean
  // Cut at a word boundary — a sentence severed mid-word reads as corruption to
  // the model as much as to a person.
  return `${clean.slice(0, max).replace(/\s+\S*$/, '')}…`
}

export function slug(text = '') {
  return (
    text
      .toLowerCase()
      // Keep Bengali codepoints: a Bengali title should not slug to "untitled".
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'script'
  )
}

/**
 * Appendix I: btoa throws InvalidCharacterError on any non-Latin-1 codepoint,
 * which every Bengali string is. Round-trip through UTF-8 first.
 */
export const utf8ToBase64 = (str) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(str)))

export const base64ToUtf8 = (b64) =>
  new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)))

/** mm:ss for scene timings and audio scrubbers. */
export function formatClock(totalSeconds = 0) {
  const s = Math.max(0, Math.round(totalSeconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

export function relativeTime(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days}d ago`
  return formatDate(iso)
}

export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?'

/** Dot-path get/set, backing useScriptStore.updateField(path, value). */
export function getPath(obj, path) {
  return String(path)
    .split('.')
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj)
}

/**
 * Returns a structurally-shared copy with `path` set — clones only the spine
 * down to the target so React sees new identities exactly where they changed.
 * Numeric segments create arrays, so 'script.scenes.0.voiceover' works on a
 * fresh object without pre-seeding the array.
 */
export function setPath(obj, path, value) {
  const keys = String(path).split('.')

  const walk = (node, depth) => {
    const key = keys[depth]
    const isIndex = /^\d+$/.test(key)
    const base = node ?? (isIndex ? [] : {})
    const copy = Array.isArray(base) ? [...base] : { ...base }
    copy[isIndex ? Number(key) : key] =
      depth === keys.length - 1 ? value : walk(base[isIndex ? Number(key) : key], depth + 1)
    return copy
  }

  return walk(obj, 0)
}
