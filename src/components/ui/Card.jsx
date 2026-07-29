export default function Card({
  title,
  subtitle,
  actions,
  padded = true,
  className = '',
  bodyClassName = '',
  children,
}) {
  const hasHeader = title || actions

  return (
    <section className={`card elev-sm flex flex-col min-w-0 ${className}`}>
      {hasHeader && (
        <header
          className="flex items-start justify-between gap-3 px-4 py-3 shrink-0"
          // The header owns the hairline only when there is a body below it, so a
          // header-only card doesn't end in a dangling rule.
          style={{ borderBottom: children ? '1px solid var(--color-divider)' : undefined }}
        >
          <div className="min-w-0">
            {title && (
              <h2 className="text-[13px] font-semibold leading-tight truncate">{title}</h2>
            )}
            {subtitle && <p className="text-xs text-dim mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
        </header>
      )}
      {children && (
        <div className={`min-w-0 ${padded ? 'p-4' : ''} ${bodyClassName}`}>{children}</div>
      )}
    </section>
  )
}
