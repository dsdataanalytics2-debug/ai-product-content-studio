# Review marks — annotate a script block, then fix it

**Date:** 2026-07-27
**Status:** Approved for implementation
**Repo:** AI Product Content Studio

## Goal

Review a script the way a team leader would: mark the specific block that has a
problem, write what is wrong, then — wearing the writer's hat — see each mark
where it applies, fix it by hand or with AI, and tick it resolved.

## Constraint that shaped the design

There is no backend. `profileName` defaults to `'You'`
(`useSettingsStore.js:82`) and every record lives in one browser's
localStorage; the only network calls are to AI providers, the product API and
the voice service. Two people on two machines cannot collaborate.

So this is a **solo two-hat workflow**: review pass, then fix pass. Nothing here
assumes or pretends otherwise. A real multi-person flow needs accounts, a shared
database and sync — a different project.

## Non-goals

- **Word-level highlights.** Marks attach to a whole block. Character offsets
  break the moment the block is rewritten — which is exactly what happens when a
  mark is acted on — and drifting annotations are worse than coarse ones.
- **Comment threads.** One note per mark, resolvable. No replies, no reopen.
  Whole-card comments already exist in the Workspace drawer for discussion.
- **Multi-user identity.** `author` is stamped from `profileName` for the record,
  not for access control.
- **AI fix on hook/cta** in this iteration — see "Deferred" below.

## Data model

A record gains one array. Nothing else changes.

```js
marks: [
  {
    id: crypto.randomUUID(),
    path: { kind: 'hook' | 'cta' | 'scene', index: number | null, field: string | null },
    note: 'Too long — cut to 8 seconds',
    author: 'You',
    when: '2026-07-27T10:04:00.000Z',
    resolvedAt: null,      // ISO string once ticked
  },
]
```

`path` addresses a block, never a character range:

| Block | path |
|---|---|
| Hook | `{ kind: 'hook', index: null, field: null }` |
| Call to action | `{ kind: 'cta', index: null, field: null }` |
| Scene 3 voiceover | `{ kind: 'scene', index: 2, field: 'voiceover' }` |

Scene fields are the ones already rendered as editable blocks in `SceneCard`:
`title`, `voiceover`, `on_screen_text`, `visual_direction`.

Records created before this feature have no `marks` key. Every read goes through
`record.marks ?? []`, so old records need no migration.

## Detached marks

A scene rewrite can return fewer scenes than before, leaving a mark on
`scenes[4]` pointing at nothing.

Such marks are **kept and surfaced**, never silently dropped: a "Detached notes"
strip renders above the script listing them with their original location, each
resolvable. Deleting them automatically would discard review feedback without
telling anyone.

A mark is detached when `path.kind === 'scene'` and
`path.index >= script.scenes.length`.

## Components

```
utils/reviewMarks.js        pure helpers — no store access
components/script/
  ReviewMarkList.jsx        renders the marks on one block + their actions
  ScriptBlock.jsx           (modified) optional marks strip beneath the text
  SceneCard.jsx             (modified) routes per-field marks to its blocks
  ScriptOutput.jsx          (modified) owns handlers, detached strip, counts
pages/TeamWorkspace.jsx     (modified) full script + Mark button per block
```

### `utils/reviewMarks.js`

Pure functions, unit-testable without a DOM:

- `makeMark({ path, note, author })` → a new mark
- `markKey(path)` → `'hook'` | `'cta'` | `'scene:2:voiceover'`, for grouping
- `groupMarks(marks)` → `Map<key, mark[]>`, open marks only
- `isDetached(mark, script)` → boolean
- `partition(marks, script)` → `{ attached, detached, resolved }`
- `openCount(marks)` → number

### `ReviewMarkList.jsx`

Pure. Props in, callbacks out — matching `ProductCard` and `SelectedProducts`.

```
props: marks, onResolve(mark), onFixWithAi(mark) | null
```

Renders each open note with author, relative time, and buttons:
**Fix with AI** (only when `onFixWithAi` is supplied) · **✓ Resolve**.

### Marked block styling

An amber ring plus a count badge on the block label — reusing the existing
`--color-warning-*` tokens rather than introducing a colour.

## Flows

### Review (Team Workspace)

The drawer currently previews only Hook and Call to action
(`TeamWorkspace.jsx:306-309`). It grows to render the full script — hook, every
scene field, cta — each with a **⚠ Mark** button that opens a one-line note
input.

Posting a mark calls `patch(record.id, { marks: [...] })`, appends to `activity`,
and the board card shows a **⚠ N** badge for open marks.

### Fix (Script Studio)

Opening the record from Library (`?id=`) loads it into `useScriptStore.current`,
which is what `ScriptOutput` renders. Marked blocks show their notes inline.

- **Edit** — the block is already inline-editable; nothing new
- **Fix with AI** — calls the existing
  `regenerateScene(index, instruction)` (`ScriptOutput.jsx:85`) passing the
  reviewer's note as the instruction. This is the whole reason the design is
  cheap: `buildSceneRegenPrompt` already accepts an instruction
- **✓ Resolve** — stamps `resolvedAt`; the ring and note disappear

Marks are written to `current` via the store's existing
`attach('marks', next)` (`useScriptStore.js:116`), so **Save** persists them like
any other field.

### Known seam

`useScriptStore.current` and the library record are separate copies. Marking in
Workspace while the same script is open in Studio will not appear there until it
is reopened from Library. Acceptable for a solo flow — one person is not in both
places at once — and calling it out beats pretending the two are live-bound.

## Deferred

**AI fix on hook and cta.** `buildSceneRegenPrompt` is scene-shaped, so those two
blocks get **Edit** and **Resolve** only. Adding a block-level regen prompt is
worth doing once the scene flow has proven itself; scenes are where nearly all
the text — and nearly all the problems — live.

## Testing

The repo has **no test runner**. `reviewMarks.js` is written as pure functions
specifically so it can be tested the moment Vitest is added:

- `markKey` is stable and distinct across all three kinds
- `isDetached` true for a scene index beyond the array, false at the boundary
- `partition` splits attached / detached / resolved without losing a mark
- `openCount` ignores resolved marks
- a mark on `scenes[4]` survives a rewrite that returns 3 scenes, as detached

Until then, verification is manual: mark a scene, rewrite it to fewer scenes,
confirm the mark appears under "Detached notes" rather than vanishing.
