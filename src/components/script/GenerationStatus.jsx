import { useEffect, useState } from 'react'
import { Loader2, X } from 'lucide-react'
import { PROVIDERS } from '../../config/models'

/**
 * Pure. The elapsed clock is local state because the parent has no reason to
 * re-render 10 times a second.
 *
 * The staged copy exists because a 20-second wait with a single spinner feels
 * broken. These stages are honest about roughly where we are — they are driven
 * by elapsed time, not fake progress, and the label says so.
 */
const STAGES = [
  { at: 0, label: 'Sending product data' },
  { at: 2500, label: 'Writing the hook' },
  { at: 7000, label: 'Building scenes' },
  { at: 14000, label: 'Timing the voiceover' },
  { at: 22000, label: 'Still working — longer scripts take a while' },
]

export default function GenerationStatus({ status, provider, startedAt, onCancel }) {
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (status !== 'generating' || !startedAt) return
    const tick = () => setElapsedMs(Date.now() - startedAt)
    tick()
    const id = setInterval(tick, 100)
    return () => clearInterval(id)
  }, [status, startedAt])

  if (status !== 'generating') return null

  const stage = [...STAGES].reverse().find((s) => elapsedMs >= s.at) ?? STAGES[0]
  const seconds = (elapsedMs / 1000).toFixed(1)

  return (
    <div
      className="flex items-center gap-3 p-3 rounded-[var(--radius-lg)]"
      style={{ background: 'var(--accent-wash)', border: '1px solid var(--accent-hairline)' }}
      role="status"
      aria-live="polite"
    >
      <Loader2
        className="w-4 h-4 shrink-0 animate-spin-slow"
        style={{ color: 'var(--color-accent)' }}
        aria-hidden="true"
      />
      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium truncate">{stage.label}…</p>
        <p className="text-[11px] text-faint mt-0.5">
          {provider ? PROVIDERS[provider]?.label : 'AI'} · {seconds}s
        </p>
      </div>
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary text-[11.5px] px-2.5 py-1.5 shrink-0"
        >
          <X className="w-3 h-3" /> Cancel
        </button>
      )}
    </div>
  )
}
