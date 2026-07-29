import Skeleton from '../ui/Skeleton'

export default function ProductGridSkeleton({ count = 6 }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="flex items-start gap-2.5 p-2.5 rounded-[var(--radius-lg)]"
          style={{ border: '1px solid var(--color-divider)' }}
        >
          <Skeleton className="w-9 h-9 shrink-0" delay={i * 0.08} />
          <div className="flex-1 flex flex-col gap-1.5">
            <Skeleton className="h-3 w-[85%]" delay={i * 0.08} />
            <Skeleton className="h-2.5 w-[45%]" delay={i * 0.08 + 0.05} />
            <Skeleton className="h-2 w-[60%]" delay={i * 0.08 + 0.1} />
          </div>
        </div>
      ))}
    </div>
  )
}
