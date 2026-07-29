import { useEffect, useRef, useState } from 'react'
import { Pencil, Copy, Check } from 'lucide-react'
import Badge from '../ui/Badge'
import { copyToClipboard } from '../../utils/exportUtils'
import { languageMeta } from '../../config/constants'

/**
 * Pure. An editable text block — click the pencil, edit in place, blur or
 * Ctrl+Enter to commit, Escape to abandon.
 *
 * Editing happens in a local draft rather than writing every keystroke to the
 * store: updateField pushes an undo entry, and one entry per character would
 * make undo useless.
 */
export default function ScriptBlock({
  label,
  emoji,
  value,
  tone = 'default',
  language = 'bn',
  onEdit,
  copyable = true,
  meta,
  /** Bigger type for the full-size view, where there is room to read. */
  large = false,
  /** Open review marks on this block — outlines it and shows a count. */
  markCount = 0,
  children,
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  useEffect(() => {
    if (!editing) return
    const el = textareaRef.current
    el?.focus()
    el?.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  const commit = () => {
    setEditing(false)
    if (draft !== value) onEdit?.(draft)
  }

  const cancel = () => {
    setDraft(value)
    setEditing(false)
  }

  const copy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    }
  }

  const isCta = tone === 'cta'
  const marked = markCount > 0
  const htmlLang = languageMeta(language).htmlLang

  return (
    <div
      className="group relative rounded-[var(--radius-lg)] p-3 transition-colors"
      style={{
        background: isCta ? 'var(--color-accent-900)' : 'var(--color-neutral-900)',
        // A marked block outranks its normal styling — the whole point is that
        // it catches the eye while scrolling a long script.
        border: `1px solid ${
          marked
            ? 'color-mix(in srgb, var(--color-warning) 45%, transparent)'
            : isCta
              ? 'var(--accent-hairline)'
              : 'var(--color-divider)'
        }`,
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 pr-14">
        {emoji && (
          <span className="text-[13px]" aria-hidden="true">
            {emoji}
          </span>
        )}
        <span className="eyebrow eyebrow-accent">{label}</span>
        {marked && (
          <Badge tone="warning">
            {markCount} {markCount === 1 ? 'note' : 'notes'}
          </Badge>
        )}
        {meta && <span className="text-[11px] text-faint ml-auto tabular-nums">{meta}</span>}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            ref={textareaRef}
            value={draft}
            lang={htmlLang}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                cancel()
              }
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                commit()
              }
            }}
            rows={Math.min(10, Math.max(2, Math.ceil(draft.length / 52)))}
            className={`input leading-relaxed resize-y ${large ? 'text-[15px]' : 'text-[13px]'}`}
          />
          <p className="text-[10.5px] text-faint">
            Ctrl+Enter to save · Escape to discard
          </p>
        </div>
      ) : (
        <p
          lang={htmlLang}
          className={`leading-relaxed whitespace-pre-wrap ${large ? 'text-[15px]' : 'text-[13px]'}`}
          style={{ color: 'var(--text-body)' }}
        >
          {value || <span className="text-faint italic">Empty</span>}
        </p>
      )}

      {children}

      {!editing && (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          {copyable && (
            <button
              type="button"
              onClick={copy}
              aria-label={`Copy ${label}`}
              className="btn btn-ghost p-1.5"
            >
              {copied ? (
                <Check className="w-3 h-3" style={{ color: 'var(--color-success)' }} />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </button>
          )}
          {onEdit && (
            <button
              type="button"
              onClick={() => setEditing(true)}
              aria-label={`Edit ${label}`}
              className="btn btn-ghost p-1.5"
            >
              <Pencil className="w-3 h-3" />
            </button>
          )}
        </div>
      )}
    </div>
  )
}
