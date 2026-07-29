export default function Toggle({ checked, onChange, label, disabled = false }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className="relative shrink-0 rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        width: 38,
        height: 22,
        background: checked ? 'var(--color-accent)' : 'var(--color-neutral-700)',
      }}
    >
      <span
        className="absolute top-[3px] rounded-full transition-[left]"
        style={{
          width: 16,
          height: 16,
          left: checked ? 19 : 3,
          background: '#fff',
          boxShadow: 'var(--shadow-sm)',
        }}
      />
    </button>
  )
}
