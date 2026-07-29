import { Check, Sparkles, MessageSquareWarning } from 'lucide-react'
import Button from '../ui/Button'
import { relativeTime } from '../../utils/text'
import { markLocation } from '../../utils/reviewMarks'

/** Matches how the warning Badge is tinted in index.css — no new tokens. */
const WASH = 'color-mix(in srgb, var(--color-warning) 11%, transparent)'
const HAIRLINE = 'color-mix(in srgb, var(--color-warning) 30%, transparent)'

/**
 * The open review notes on one block, with the two ways to act on them.
 *
 * Pure. Props in, callbacks out — the same contract as ProductCard.
 *
 * `onFixWithAi` is optional: hook and CTA have no scene-shaped regeneration
 * prompt, so they get Edit (already inline) and Resolve only. Passing null hides
 * the button rather than showing one that cannot work.
 */
export default function ReviewMarkList({
  marks,
  onResolve,
  onFixWithAi = null,
  showLocation = false,
  busy = false,
}) {
  if (!marks || marks.length === 0) return null

  return (
    <ul className="flex flex-col gap-1.5 mt-1.5">
      {marks.map((mark) => (
        <li
          key={mark.id}
          className="rounded-[var(--radius-md)] border px-2 py-1.5"
          style={{ background: WASH, borderColor: HAIRLINE }}
        >
          <div className="flex items-start gap-1.5">
            <MessageSquareWarning
              className="w-3.5 h-3.5 shrink-0 mt-px"
              style={{ color: 'var(--color-warning-text)' }}
              aria-hidden="true"
            />
            <div className="flex-1 min-w-0">
              {showLocation && (
                <p className="text-[10px] uppercase tracking-wide text-faint mb-0.5">
                  {markLocation(mark.path)}
                </p>
              )}
              <p className="text-[12px] leading-snug" style={{ color: 'var(--text-body)' }}>
                {mark.note}
              </p>
              <p className="text-[10.5px] text-faint mt-0.5">
                {mark.author} · {relativeTime(mark.when)}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {onFixWithAi && (
              <Button
                size="xs"
                variant="secondary"
                icon={Sparkles}
                loading={busy}
                onClick={() => onFixWithAi(mark)}
              >
                Fix with AI
              </Button>
            )}
            <Button size="xs" variant="ghost" icon={Check} onClick={() => onResolve(mark)}>
              Resolve
            </Button>
          </div>
        </li>
      ))}
    </ul>
  )
}
