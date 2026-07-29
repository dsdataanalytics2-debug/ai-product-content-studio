import { useId } from 'react'

export default function Select({ label, value, onChange, options = [], hint, className = '', ...props }) {
  const id = useId()

  return (
    <div className="field">
      {label && (
        <label htmlFor={id} className="text-[11.5px] font-medium text-dim">
          {label}
        </label>
      )}
      <select
        id={id}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        className={`input text-[13px] ${className}`}
        {...props}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {hint && <p className="text-[11.5px] text-faint">{hint}</p>}
    </div>
  )
}
