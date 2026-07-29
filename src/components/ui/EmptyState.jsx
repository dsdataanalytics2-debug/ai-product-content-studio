/**
 * Every list uses this. Never render a bare "no results" string — an empty
 * state is where you tell someone what to do next, and it is the screen new
 * users see most.
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  dashed = false,
  compact = false,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${compact ? 'px-4 py-7' : 'px-6 py-12'} ${className}`}
      style={
        dashed
          ? { border: '1.5px dashed var(--color-divider)', borderRadius: 'var(--radius-lg)' }
          : undefined
      }
    >
      {Icon && (
        <Icon
          className={compact ? 'w-7 h-7 mb-2.5' : 'w-10 h-10 mb-3'}
          style={{ color: 'var(--color-accent)', opacity: 0.65 }}
          aria-hidden="true"
        />
      )}
      <p className={`${compact ? 'text-[13px]' : 'text-sm'} font-medium`}>{title}</p>
      {description && (
        <p className="text-xs text-dim leading-relaxed mt-1.5 max-w-[42ch]">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
