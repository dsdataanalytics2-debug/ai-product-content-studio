import { Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react'
import { useToastStore } from '../../store/useToastStore'

const TONES = {
  success: { Icon: CheckCircle2, color: 'var(--color-success)' },
  danger: { Icon: AlertTriangle, color: 'var(--color-danger-text)' },
  warning: { Icon: AlertTriangle, color: 'var(--color-warning-text)' },
  info: { Icon: Info, color: 'var(--color-accent)' },
}

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div
      className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]"
      role="region"
      aria-label="Notifications"
    >
      {toasts.map((t) => {
        const { Icon, color } = TONES[t.tone] ?? TONES.info
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className="card elev-lg flex items-start gap-2.5 p-3 animate-fade-up"
            style={{ background: 'var(--color-surface-2)' }}
          >
            <Icon className="w-4 h-4 shrink-0 mt-px" style={{ color }} aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[12.5px] font-medium leading-snug">{t.title}</p>
              {t.body && <p className="text-[11.5px] text-dim leading-relaxed mt-1">{t.body}</p>}
              {t.action?.to && (
                <Link
                  to={t.action.to}
                  onClick={() => dismiss(t.id)}
                  className="inline-block text-[11.5px] font-medium mt-1.5"
                >
                  {t.action.label} →
                </Link>
              )}
              {/* An action that runs code rather than navigating — undo, retry.
                  Dismissing after it fires stops a second click repeating it. */}
              {t.action?.onClick && !t.action.to && (
                <button
                  type="button"
                  onClick={() => {
                    t.action.onClick()
                    dismiss(t.id)
                  }}
                  className="inline-block text-[11.5px] font-medium mt-1.5 underline"
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss notification"
              className="btn btn-ghost p-1 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
