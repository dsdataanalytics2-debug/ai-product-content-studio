import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])'

/**
 * Closes on Escape and on backdrop click, and traps focus.
 *
 * Focus trap is hand-rolled rather than pulled from a library: it is 20 lines,
 * and the alternative is a dependency whose behaviour we'd have to learn anyway
 * the first time the keyboard-only pass in the pre-ship checklist fails.
 */
/**
 * `bare` skips the header, footer and padding, handing the panel over to the
 * caller. Used for content that already owns its own chrome — a full-bleed
 * script view brings its own title bar, tabs and action bar, and wrapping that
 * in a second header would give it two.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 460,
  bare = false,
  height,
}) {
  const panelRef = useRef(null)
  const restoreFocusTo = useRef(null)

  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement
    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'

    // Focus the first control, or the panel itself if the modal is text-only.
    const panel = panelRef.current
    const first = panel?.querySelector(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !panel) return

      const nodes = [...panel.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null)
      if (nodes.length === 0) {
        e.preventDefault()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]

      if (e.shiftKey && document.activeElement === firstNode) {
        e.preventDefault()
        lastNode.focus()
      } else if (!e.shiftKey && document.activeElement === lastNode) {
        e.preventDefault()
        firstNode.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.body.style.overflow = overflow
      restoreFocusTo.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgb(0 0 0 / 0.6)', backdropFilter: 'blur(2px)' }}
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        className={`card elev-lg relative w-full animate-fade-up flex flex-col ${
          bare ? 'overflow-hidden' : 'max-h-[85vh]'
        }`}
        style={{
          maxWidth: width,
          background: 'var(--color-surface)',
          ...(bare ? { height: height ?? '88vh' } : null),
        }}
      >
        {bare ? (
          children
        ) : (
          <>
        <header className="flex items-start gap-3 px-5 pt-4 pb-3 shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && (
              <p className="text-[12.5px] text-dim leading-relaxed mt-1.5">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="btn btn-ghost p-1.5 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {children && <div className="scroll-y px-5 pb-4">{children}</div>}

        {footer && (
          <footer
            className="flex items-center justify-end gap-2 px-5 py-3 shrink-0"
            style={{ borderTop: '1px solid var(--color-divider)' }}
          >
            {footer}
          </footer>
        )}
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
