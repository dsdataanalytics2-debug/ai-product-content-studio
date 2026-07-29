export default function Skeleton({ className = '', delay = 0, style }) {
  return (
    <div
      className={`sk-line ${className}`}
      style={{ animationDelay: delay ? `${delay}s` : undefined, ...style }}
      aria-hidden="true"
    />
  )
}
