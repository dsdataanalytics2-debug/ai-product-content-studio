import { useEffect, useRef, useState } from 'react'
import { X, Bookmark, FolderOpen, ChevronDown, Check } from 'lucide-react'
import Button from '../ui/Button'
import { PROMPT_TEMPLATES, PROMPT_MAX_CHARS } from '../../config/constants'
import { usePromptStore } from '../../store/usePromptStore'
import { toast } from '../../store/useToastStore'

/**
 * Starter templates, plus your own saved directions.
 *
 * The saved list is a popover built on the same grammar as ExportMenu — card,
 * elev-lg, role="menu", dismiss on outside click or Escape — so it reads as part
 * of the app rather than a second idea about what a dropdown is.
 *
 * Each row shows the prompt's text under its name, ruled down the left like a
 * quotation, because that is what a saved prompt is: a piece of writing you want
 * back. A label alone ("Emotional, mothers") does not tell you what you wrote
 * three weeks ago, and choosing blind is why prompt libraries go unused.
 *
 * Clicking any chip or row replaces the textarea, matching how the built-in
 * templates already behaved.
 */
/** Tall enough for ~4 entries; the list scrolls past that. */
const MENU_MAX_HEIGHT = 280

export default function PromptChips({ value, onApply }) {
  const prompts = usePromptStore((s) => s.prompts)
  const savePrompt = usePromptStore((s) => s.save)
  const removePrompt = usePromptStore((s) => s.remove)
  const restorePrompt = usePromptStore((s) => s.restore)
  const touchPrompt = usePromptStore((s) => s.touch)

  const [naming, setNaming] = useState(false)
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [justSaved, setJustSaved] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const wrapperRef = useRef(null)

  /**
   * Opens upward when there is not enough room below.
   *
   * This button sits near the bottom of the config column, which scrolls
   * (`scroll-y`) and therefore clips anything overflowing it. A menu that always
   * dropped down was cut off exactly where it is most used. Measured on open
   * rather than assumed, because the panel scrolls and the same button can be
   * anywhere on screen.
   */
  useEffect(() => {
    if (!open) return
    const rect = wrapperRef.current?.getBoundingClientRect()
    if (!rect) return
    const below = window.innerHeight - rect.bottom
    setDropUp(below < MENU_MAX_HEIGHT + 16 && rect.top > below)
  }, [open])

  // Same dismissal contract as every other menu in the app.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      if (!wrapperRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const ordered = [...prompts].sort(
    (a, b) => new Date(b.lastUsedAt ?? b.createdAt) - new Date(a.lastUsedAt ?? a.createdAt),
  )

  const startSaving = () => {
    setLabel(value.trim().slice(0, 30))
    setNaming(true)
  }

  const confirmSave = () => {
    const saved = savePrompt({ label, text: value })
    setNaming(false)
    setLabel('')
    if (saved) {
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1800)
      toast.success('Prompt saved', `“${saved.label}” is now one click away.`)
    }
  }

  const apply = (prompt) => {
    onApply(prompt.text.slice(0, PROMPT_MAX_CHARS))
    if (prompt.id) touchPrompt(prompt.id)
  }

  const remove = (prompt) => {
    removePrompt(prompt.id)
    // Undo rather than a confirm dialog: deleting a saved prompt is low-stakes
    // and reversible, and a modal would cost more attention than the mistake.
    toast.info('Prompt deleted', `“${prompt.label}” removed.`, {
      label: 'Undo',
      onClick: () => restorePrompt(prompt),
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {PROMPT_TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => apply({ text: t.text })}
              className="px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] transition-colors hover:bg-[var(--bg-hover)]"
              style={{
                background: 'transparent',
                borderColor: 'var(--color-divider)',
                color: 'var(--text-dim)',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-faint shrink-0 tabular-nums">
          {value.length}/{PROMPT_MAX_CHARS}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {ordered.length > 0 && (
          <div ref={wrapperRef} className="relative">
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-haspopup="menu"
              className="btn btn-secondary px-2.5 py-1.5 text-[11.5px]"
            >
              <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Saved prompts
              <span
                className="grid place-items-center min-w-[17px] h-[17px] px-1 rounded-[var(--radius-pill)] text-[10px] font-semibold tabular-nums"
                style={{ background: 'var(--color-accent)', color: '#fff' }}
              >
                {ordered.length}
              </span>
              <ChevronDown className="w-3 h-3 shrink-0" aria-hidden="true" />
            </button>

            {open && (
              <div
                role="menu"
                className={`card elev-lg absolute left-0 z-40 w-[300px] overflow-y-auto p-1.5 animate-fade-up ${
                  dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
                }`}
                style={{ background: 'var(--color-surface-2)', maxHeight: MENU_MAX_HEIGHT }}
              >
                {ordered.map((p) => (
                  <div
                    key={p.id}
                    className="group flex items-start gap-1.5 px-2 py-2 rounded-[var(--radius-md)] transition-colors hover:bg-[var(--bg-hover)]"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        apply(p)
                        setOpen(false)
                      }}
                      className="flex-1 min-w-0 text-left"
                    >
                      <span className="block text-[12.5px] font-medium truncate">{p.label}</span>
                      {/* Ruled like a quotation — this is the writing itself,
                          not a description of it. */}
                      <span
                        className="block text-[11px] text-faint leading-snug line-clamp-2 mt-1 pl-2"
                        style={{ borderLeft: '2px solid var(--accent-hairline-strong)' }}
                      >
                        {p.text}
                      </span>
                    </button>

                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {/* Usage is real information: it says which of these you
                          actually rely on, and it is already tracked. */}
                      <span className="text-[10px] text-faint tabular-nums">
                        {p.useCount ? `${p.useCount}×` : 'new'}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(p)}
                        aria-label={`Delete ${p.label}`}
                        className="grid place-items-center w-5 h-5 rounded-[3px] opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity hover:bg-[var(--color-neutral-800)]"
                      >
                        <X className="w-3 h-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {!naming && (
          <Button
            size="xs"
            variant="ghost"
            icon={justSaved ? Check : Bookmark}
            disabled={!value.trim()}
            onClick={startSaving}
          >
            {justSaved ? 'Saved' : 'Save this prompt'}
          </Button>
        )}
      </div>

      {naming && (
        <div className="flex gap-1.5">
          <input
            autoFocus
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmSave()
              if (e.key === 'Escape') setNaming(false)
            }}
            placeholder="Name this prompt"
            aria-label="Prompt name"
            className="input text-[12px] py-1"
          />
          <Button size="xs" onClick={confirmSave}>
            Save
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setNaming(false)}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
