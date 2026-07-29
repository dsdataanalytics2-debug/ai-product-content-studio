# Saved prompts — reuse your direction to the AI

**Date:** 2026-07-27
**Status:** Awaiting approval
**Repo:** AI Product Content Studio

## Goal

Write a direction once in *"Your direction to the AI"*, save it, and reapply it on
any later script with one click — alongside the three built-in templates.

## What exists today

`ScriptConfig.jsx` renders a 500-character textarea bound to `config.userPrompt`,
plus:

- **Enhance** — rewrites the current text via the AI (`buildEnhancePromptPrompt`)
- Three hardcoded chips from `PROMPT_TEMPLATES` (Emotional Hook / Hard Sell /
  Urgency CTA) that **replace** the textarea when clicked

The text is stored per-script inside `record.config`, so it survives on that
script — but there is no way to reuse it on the next one. Nothing is missing at
the data layer; there is simply no library.

## Design

### 1. `usePromptStore` — new persisted store

Follows `useBrandStore` exactly (same persist shape, same `acs_` key naming).

```js
// name: 'acs_prompts'
prompts: [
  {
    id: crypto.randomUUID(),
    label: 'Emotional, mothers',   // short, editable
    text: '…up to PROMPT_MAX_CHARS…',
    createdAt, updatedAt,
    lastUsedAt: null,
    useCount: 0,
  },
]
```

Actions: `save({ id?, label, text })` (upsert), `remove(id)`, `rename(id, label)`,
`touch(id)`, `clear()`.

**Backup needs no work.** `exportBackup` sweeps every `acs_`-prefixed localStorage
key except `acs_api` (`storage.js:111-122`), so `acs_prompts` is included in
Export/Restore automatically.

**Cap at 50 prompts.** At 500 chars each that is ~25 KB — trivial next to the
catalogue's ~1.5 MB, but an uncapped list eventually competes with it for the
same ~5 MB budget. Saving the 51st replaces the least recently used, with a toast
saying so.

### 2. Saving

A **Save** button next to **Enhance** in the section header, enabled when the
textarea is non-empty.

Clicking it reveals an inline label input pre-filled with the first ~30
characters of the text; Enter confirms, Escape cancels. No modal — the section is
already a compact block and a dialog for one field is heavier than the task.

**Duplicates are folded, not stacked.** If the trimmed text already exists, the
existing entry is touched rather than a second copy created. Saving the same
direction twice is a slip, not an intent.

### 3. Applying

The chip row below the textarea becomes two groups:

```
Templates   ⚡ Emotional Hook   🎯 Hard Sell   📢 Urgency CTA
Saved       Emotional, mothers ×   Ramadan urgency ×   Cold audience ×
```

- Click a chip → replaces the textarea, matching how the built-in templates
  already behave. One rule for both rows.
- `×` on a saved chip deletes it, with an undo toast.
- Saved chips sort by `lastUsedAt` descending, so what you use stays in reach.
- The row scrolls horizontally rather than wrapping to five lines.

### 4. Files

```
src/store/usePromptStore.js         new
src/components/script/PromptChips.jsx  new — pure, both rows + save/delete
src/components/script/ScriptConfig.jsx modified — swap the inline chip row
```

`ScriptConfig.jsx` is already ~260 lines and owns video type, tone, language,
duration, audience, brand and the prompt block. The chip row plus save-and-label
state is enough behaviour to earn its own file, following `SelectedProducts.jsx`.

## Non-goals

- **Sharing prompts between people.** No backend; same constraint as review marks.
  Export/Restore moves them between machines.
- **Folders, tags, search.** Fifty prompts sorted by recent use does not need
  hierarchy. Revisit if that cap is ever hit.
- **Variables/placeholders** (`{product}`, `{audience}`). A templating language is
  a much larger feature and the prompt already sits next to fields that carry
  that context.
- **Auto-saving every prompt used.** Saving is deliberate; a library that fills
  itself with one-off experiments is noise.

## Open decisions

1. **Should saved prompts also appear on the scene-level rewrite box?**
   `SceneCard` has its own free-text instruction for regenerating one scene, and
   the same directions apply ("shorter", "more urgent"). Reusing `PromptChips`
   there is small once it exists, but it is a second surface. *Recommendation:
   ship the config section first, add it after.*

2. **Replace or append on click?** Templates replace today. Appending would let
   you stack directions, but silently growing text against a 500-char cap is
   confusing. *Recommendation: replace, consistent with existing behaviour.*

## Testing

The repo still has no test runner. `usePromptStore` will be written so its
reducer logic is testable the moment Vitest is added:

- upsert by id updates rather than appends
- saving identical trimmed text touches the existing entry, no duplicate
- the 50-cap evicts the least recently used, never the most recent
- `remove` then undo restores the same id
- prompts land in `exportBackup` output and survive `importBackup`

Manual verification meanwhile: save a prompt, reload, confirm it persists and
applies.

## Estimate

Two to three hours including the store, the component, wiring, and manual checks.
