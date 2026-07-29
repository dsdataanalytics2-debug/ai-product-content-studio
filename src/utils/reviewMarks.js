/**
 * Review marks — a note pinned to one block of a script.
 *
 * Marks address a *block*, never a character range. Offsets would be more
 * precise and completely untrustworthy: acting on a mark rewrites the text it
 * points at, so stored offsets drift onto the wrong words or detach entirely.
 * A block reference survives any rewrite of its contents.
 *
 * Pure functions only — no store access, no DOM. Everything here is a function
 * of (marks, script).
 */

/** Scene fields that render as their own editable block, and can be marked. */
export const MARKABLE_SCENE_FIELDS = ['title', 'voiceover', 'on_screen_text', 'visual_direction']

export const SCENE_FIELD_LABELS = {
  title: 'Title',
  voiceover: 'Voiceover',
  on_screen_text: 'On-screen text',
  visual_direction: 'Visual direction',
}

export const hookPath = () => ({ kind: 'hook', index: null, field: null })
export const ctaPath = () => ({ kind: 'cta', index: null, field: null })
export const scenePath = (index, field) => ({ kind: 'scene', index, field })
export const shotPath = (index) => ({ kind: 'shot', index, field: null })

/**
 * What a mark can point at, extracted from a record.
 *
 * Marks span two arrays that live in different places — scenes under `script`,
 * shots on the record — so detachment cannot be judged from either one alone.
 * Every function below takes this context rather than a bare script.
 */
export const markContext = (record) => ({
  scenes: record?.script?.scenes ?? [],
  shots: record?.shots ?? [],
})

export function makeMark({ path, note, author = 'You' }) {
  return {
    id: crypto.randomUUID(),
    path,
    note: String(note).trim(),
    author,
    when: new Date().toISOString(),
    resolvedAt: null,
  }
}

/** Stable identity for a block, so marks can be grouped and looked up. */
export function markKey(path) {
  if (!path) return ''
  if (path.kind === 'scene') return `scene:${path.index}:${path.field}`
  if (path.kind === 'shot') return `shot:${path.index}`
  return path.kind
}

/** Human-readable location, for the detached list where the block is gone. */
export function markLocation(path) {
  if (!path) return 'Unknown'
  if (path.kind === 'hook') return 'Hook'
  if (path.kind === 'cta') return 'Call to action'
  if (path.kind === 'shot') return `Shot ${path.index + 1}`
  return `Scene ${path.index + 1} · ${SCENE_FIELD_LABELS[path.field] ?? path.field}`
}

export const isResolved = (mark) => Boolean(mark.resolvedAt)

/**
 * A mark whose target no longer exists — a scene rewrite can return fewer
 * scenes, and regenerating the shot list replaces it wholesale. These are kept
 * and surfaced rather than dropped, because silently discarding review feedback
 * is worse than showing it out of place.
 */
export function isDetached(mark, context) {
  const kind = mark.path?.kind
  if (kind !== 'scene' && kind !== 'shot') return false

  const list = kind === 'scene' ? (context?.scenes ?? []) : (context?.shots ?? [])
  return mark.path.index == null || mark.path.index >= list.length
}

/** Open marks bucketed by block key, for rendering next to each block. */
export function groupMarks(marks = [], context) {
  const grouped = new Map()
  for (const mark of marks) {
    if (isResolved(mark) || isDetached(mark, context)) continue
    const key = markKey(mark.path)
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key).push(mark)
  }
  return grouped
}

/** Every mark, sorted into the three states the UI renders differently. */
export function partition(marks = [], context) {
  const attached = []
  const detached = []
  const resolved = []

  for (const mark of marks) {
    if (isResolved(mark)) resolved.push(mark)
    else if (isDetached(mark, context)) detached.push(mark)
    else attached.push(mark)
  }

  return { attached, detached, resolved }
}

/** Open marks, resolved or not yet detached — what the board badge counts. */
export const openCount = (marks = []) => marks.filter((m) => !isResolved(m)).length

/** Marks with `id` stamped resolved. Returns a new array; never mutates. */
export function resolveMark(marks = [], id) {
  const now = new Date().toISOString()
  return marks.map((m) => (m.id === id && !m.resolvedAt ? { ...m, resolvedAt: now } : m))
}
