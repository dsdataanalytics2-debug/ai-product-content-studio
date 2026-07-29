import { Check } from 'lucide-react'
import Badge from '../ui/Badge'

/** Pure. Props in, onToggle out — no store access. */
export default function ProductCard({ product, selected, onToggle, disabled = false }) {
  const onSale = Boolean(product.salePrice)

  return (
    <button
      type="button"
      onClick={() => onToggle(product.id)}
      disabled={disabled && !selected}
      aria-pressed={selected}
      title={disabled && !selected ? 'Selection limit reached' : undefined}
      className="w-full flex items-start gap-2.5 p-2.5 rounded-[var(--radius-lg)] border text-left
                 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      style={{
        background: selected ? 'var(--accent-wash)' : 'var(--color-neutral-900)',
        borderColor: selected ? 'var(--accent-hairline-strong)' : 'var(--color-divider)',
      }}
    >
      {product.image ? (
        <img
          src={product.image}
          alt=""
          loading="lazy"
          className="w-9 h-9 rounded-[var(--radius-md)] object-cover shrink-0"
          style={{ background: 'var(--color-neutral-800)' }}
        />
      ) : (
        <span
          className="grid place-items-center w-9 h-9 rounded-[var(--radius-md)] text-lg shrink-0"
          style={{ background: 'var(--color-neutral-800)' }}
          aria-hidden="true"
        >
          {product.emoji}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-[12.5px] font-medium leading-snug line-clamp-2">{product.name}</p>

        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
          <span className="text-[12px]" style={{ color: 'var(--color-accent-300)' }}>
            {onSale ? product.salePrice : product.price}
          </span>
          {onSale && (
            <span className="text-[10.5px] line-through text-faint">{product.price}</span>
          )}
          {onSale && <Badge tone="accent">Sale</Badge>}
          {product.stockStatus === 'outofstock' && <Badge tone="danger">Out of stock</Badge>}
        </div>

        <p className="text-[10.5px] text-faint mt-0.5 truncate">
          {product.categories.join(' · ') || product.sku}
        </p>
      </div>

      <span
        className="grid place-items-center w-[18px] h-[18px] rounded-[5px] shrink-0 mt-0.5"
        style={{
          background: selected ? 'var(--color-accent)' : 'transparent',
          border: selected ? 'none' : '1.5px solid var(--color-neutral-700)',
          color: '#fff',
        }}
        aria-hidden="true"
      >
        {selected && <Check className="w-3 h-3" strokeWidth={3} />}
      </span>
    </button>
  )
}
