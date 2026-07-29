import { useId, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'

/**
 * `masked` adds the eye toggle (used for API keys).
 * `dir`/`lang` exist for Bengali: Bengali is LTR, but the container needs
 * lang="bn" so the Noto Sans Bengali stack and the wider line-height apply.
 */
export default function Input({
  label,
  value,
  onChange,
  type = 'text',
  error,
  hint,
  placeholder,
  masked = false,
  dir,
  lang,
  multiline = false,
  rows = 3,
  mono = false,
  className = '',
  ...props
}) {
  const id = useId()
  const [revealed, setRevealed] = useState(false)

  const describedBy = [error && `${id}-error`, hint && !error && `${id}-hint`]
    .filter(Boolean)
    .join(' ')

  const shared = {
    id,
    value: value ?? '',
    onChange: (e) => onChange?.(e.target.value),
    placeholder,
    dir,
    lang,
    'aria-invalid': error ? true : undefined,
    'aria-describedby': describedBy || undefined,
    className: `input text-[13px] ${error ? 'input-error' : ''} ${mono ? 'font-mono tracking-wide' : ''} ${masked ? 'pr-9' : ''} ${multiline ? 'resize-y min-h-[64px]' : ''}`,
    ...props,
  }

  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className="text-[11.5px] font-medium text-dim">
          {label}
        </label>
      )}

      <div className={`relative ${className}`}>
        {multiline ? (
          <textarea rows={rows} {...shared} />
        ) : (
          <input type={masked && !revealed ? 'password' : type} {...shared} />
        )}

        {masked && !multiline && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? 'Hide value' : 'Show value'}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded text-faint hover:text-[var(--color-text)]"
          >
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {error ? (
        <p id={`${id}-error`} className="text-[11.5px]" style={{ color: 'var(--color-danger-text)' }}>
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-[11.5px] text-faint leading-relaxed">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
