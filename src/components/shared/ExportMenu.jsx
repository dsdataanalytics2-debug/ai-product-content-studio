import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, ChevronDown, Clipboard, Check, AlertTriangle } from 'lucide-react'
import {
  exportAsTXT,
  exportAsJSON,
  exportAsDOCX,
  exportAsPDF,
  exportAsSRT,
  exportAsVTT,
  exportShotListCSV,
  scriptToText,
  copyToClipboard,
  PDF_SUPPORTS_LANGUAGE,
} from '../../utils/exportUtils'
import { toast } from '../../store/useToastStore'

const ALL_FORMATS = {
  txt: { label: 'Plain text (.txt)', hint: 'Always works', run: exportAsTXT },
  docx: { label: 'Word (.docx)', hint: 'Best for Bengali', run: exportAsDOCX },
  pdf: { label: 'PDF (.pdf)', hint: 'English only', run: exportAsPDF },
  json: { label: 'JSON (.json)', hint: 'Full record', run: exportAsJSON },
  srt: { label: 'Subtitles (.srt)', hint: 'For editors', run: exportAsSRT },
  vtt: { label: 'Subtitles (.vtt)', hint: 'For web video', run: exportAsVTT },
  csv: { label: 'Shot list (.csv)', hint: 'Opens in Excel', run: exportShotListCSV },
}

/** Roughly eight rows; the list scrolls past that rather than growing. */
const MENU_MAX_HEIGHT = 340
/** Wider than the old 248 to carry the larger row text without wrapping. */
const MENU_WIDTH = 300

export default function ExportMenu({
  record,
  formats = ['txt', 'docx', 'pdf', 'json', 'srt', 'vtt'],
  size = 'md',
  block = false,
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(null)
  const [copied, setCopied] = useState(false)
  const [dropUp, setDropUp] = useState(false)
  const [coords, setCoords] = useState({ left: 0, top: 0, bottom: undefined })
  const wrapperRef = useRef(null)
  const menuRef = useRef(null)

  /**
   * Positions the menu in viewport coordinates.
   *
   * The menu is portalled to <body> rather than nested under the button, because
   * in the Studio this button sits in the action bar of a column styled
   * `overflow-hidden`. A nested menu is clipped by that column no matter how
   * high its z-index — Export looked like a dead button. Escaping to the body
   * lets it float over the script instead.
   *
   * Recomputed on scroll and resize, since the panel it sits in scrolls
   * independently of the page.
   */
  useEffect(() => {
    if (!open) return

    const place = () => {
      const rect = wrapperRef.current?.getBoundingClientRect()
      if (!rect) return
      const below = window.innerHeight - rect.bottom
      const up = below < MENU_MAX_HEIGHT + 16 && rect.top > below

      setDropUp(up)
      setCoords({
        // Right-aligned to the trigger, clamped so it never leaves the viewport.
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
        top: up ? undefined : rect.bottom + 6,
        bottom: up ? window.innerHeight - rect.top + 6 : undefined,
      })
    }

    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e) => {
      // The menu is portalled to <body>, so it is NOT inside wrapperRef — both
      // have to be checked or clicking a menu item dismisses before it fires.
      if (wrapperRef.current?.contains(e.target) || menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    const onKeyDown = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const isBengali = record?.config?.language !== 'en'

  const run = async (key) => {
    setBusy(key)
    try {
      await ALL_FORMATS[key].run(record)
      setOpen(false)
    } catch (err) {
      console.error(`[ExportMenu] ${key} export failed`, err)
      toast.error('Export failed', err.message)
    } finally {
      setBusy(null)
    }
  }

  const copy = async () => {
    if (await copyToClipboard(scriptToText(record))) {
      setCopied(true)
      toast.success('Script copied', 'Plain text, ready to paste anywhere.')
      setTimeout(() => setCopied(false), 1800)
      setOpen(false)
    }
  }

  if (!record) return null

  return (
    <div ref={wrapperRef} className={`relative ${block ? 'w-full' : ''}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`btn btn-primary ${block ? 'w-full' : ''} ${
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm'
        }`}
      >
        <Download className="w-4 h-4" /> Export
        <ChevronDown className="w-3 h-3" aria-hidden="true" />
      </button>

      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          className="card elev-lg fixed z-[60] overflow-y-auto p-1.5 animate-fade-up"
          style={{
            background: 'var(--color-surface-2)',
            width: MENU_WIDTH,
            maxHeight: MENU_MAX_HEIGHT,
            left: coords.left,
            top: coords.top,
            bottom: coords.bottom,
          }}
        >
          <button
            type="button"
            role="menuitem"
            onClick={copy}
            className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[var(--radius-md)] text-left text-[14px] transition-colors hover:bg-[var(--bg-hover)]"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--color-success)' }} />
            ) : (
              <Clipboard className="w-4 h-4 shrink-0 text-faint" />
            )}
            <span className="flex-1">Copy to clipboard</span>
            <span className="text-[12px] text-faint">Never fails</span>
          </button>

          <hr className="divider my-1.5" />

          {formats.map((key) => {
            const fmt = ALL_FORMATS[key]
            if (!fmt) return null

            const pdfBlocked = key === 'pdf' && !PDF_SUPPORTS_LANGUAGE(record.config.language)
            const noShots = key === 'csv' && !record.shots?.length

            return (
              <button
                key={key}
                type="button"
                role="menuitem"
                onClick={() => run(key)}
                disabled={busy === key || pdfBlocked || noShots}
                title={
                  pdfBlocked
                    ? 'jsPDF cannot shape Bengali conjuncts correctly. Export DOCX and save as PDF from Word.'
                    : noShots
                      ? 'Generate a shot list first (Shots tab).'
                      : undefined
                }
                className="w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-[var(--radius-md)] text-left text-[14px] transition-colors hover:bg-[var(--bg-hover)] disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Download className="w-4 h-4 shrink-0 text-faint" />
                <span className="flex-1">{fmt.label}</span>
                {pdfBlocked ? (
                  <AlertTriangle
                    className="w-3 h-3 shrink-0"
                    style={{ color: 'var(--color-warning)' }}
                  />
                ) : (
                  <span className="text-[12px] text-faint">{busy === key ? '…' : fmt.hint}</span>
                )}
              </button>
            )
          })}

          {isBengali && (
            <p
              className="text-[11.5px] leading-relaxed px-2.5 pt-2 mt-1.5"
              style={{ borderTop: '1px solid var(--color-divider)', color: 'var(--text-faint)' }}
            >
              Bengali PDF is disabled on purpose — jsPDF renders যুক্তাক্ষর wrong. Export DOCX and
              let Word make the PDF.
            </p>
          )}
        </div>,
        document.body,
      )}
    </div>
  )
}
