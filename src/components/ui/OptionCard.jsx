import { Check } from 'lucide-react'

/**
 * The clickable card used throughout ScriptConfig. `icon` may be a Lucide
 * component or a plain string (the config screens use emoji).
 *
 * `disabledReason` is shown as the title so a disabled option explains itself
 * on hover instead of just failing to respond.
 */
export default function OptionCard({
  icon: Icon,
  label,
  sublabel,
  selected,
  onClick,
  disabled = false,
  disabledReason,
  compact = false,
  showCheck = false,
  className = '',
}) {
  const isEmoji = typeof Icon === 'string'

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      role="radio"
      aria-checked={!!selected}
      title={disabled ? disabledReason : undefined}
      className={`relative flex flex-col items-center justify-center gap-1 rounded-[var(--radius-lg)]
        border text-center transition-colors disabled:opacity-45 disabled:cursor-not-allowed
        ${compact ? 'px-2.5 py-2' : 'px-3 py-3'} ${className}`}
      style={{
        background: selected ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
        borderColor: selected ? 'var(--accent-hairline-strong)' : 'var(--color-divider)',
        color: selected ? 'var(--color-accent-300)' : 'var(--text-body)',
      }}
    >
      {Icon &&
        (isEmoji ? (
          <span className={compact ? 'text-base' : 'text-xl'} aria-hidden="true">
            {Icon}
          </span>
        ) : (
          <Icon className={compact ? 'w-4 h-4' : 'w-5 h-5'} aria-hidden="true" />
        ))}

      <span className="text-xs font-medium leading-tight">{label}</span>
      {sublabel && <span className="text-[10.5px] text-faint leading-tight">{sublabel}</span>}

      {showCheck && selected && (
        <span
          className="absolute top-1.5 right-1.5 grid place-items-center w-4 h-4 rounded-full"
          style={{ background: 'var(--color-accent)', color: '#fff' }}
        >
          <Check className="w-2.5 h-2.5" strokeWidth={3} />
        </span>
      )}
    </button>
  )
}
