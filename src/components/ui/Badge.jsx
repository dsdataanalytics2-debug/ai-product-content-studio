const TONES = {
  neutral: 'tag-neutral',
  outline: 'tag-outline',
  accent: 'tag-accent',
  success: 'tag-success',
  warning: 'tag-warning',
  danger: 'tag-danger',
}

export default function Badge({ children, tone = 'neutral', dot = false, className = '' }) {
  return (
    <span className={`tag ${TONES[tone] ?? TONES.neutral} ${className}`}>
      {dot && (
        <span
          className="w-[6px] h-[6px] rounded-full shrink-0"
          style={{ background: 'currentColor' }}
          aria-hidden="true"
        />
      )}
      {children}
    </span>
  )
}
