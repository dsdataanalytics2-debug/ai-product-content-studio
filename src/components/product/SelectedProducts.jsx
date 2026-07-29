import { X } from 'lucide-react'

/**
 * The products currently chosen, shown as removable chips.
 *
 * The card list already highlights a selected product, but that only helps for
 * cards on screen — search for something else, or scroll a few hundred products
 * on, and the only remaining trace is a count. This keeps the actual choices
 * visible next to the Generate button, where the decision is made.
 *
 * Pure. Props in, onRemove out — no store access.
 */
export default function SelectedProducts({ products, onRemove }) {
  if (products.length === 0) return null

  return (
    <ul className="flex flex-wrap gap-1.5 mb-2" aria-label="Selected products">
      {products.map((product) => (
        <li
          key={product.id}
          className="flex items-center gap-1.5 pl-1 pr-0.5 py-0.5 rounded-[var(--radius-md)] border max-w-full"
          style={{
            background: 'var(--accent-wash)',
            borderColor: 'var(--accent-hairline-strong)',
          }}
        >
          {product.image ? (
            <img
              src={product.image}
              alt=""
              loading="lazy"
              className="w-4 h-4 rounded-[3px] object-cover shrink-0"
              style={{ background: 'var(--color-neutral-800)' }}
            />
          ) : (
            <span className="text-[11px] shrink-0" aria-hidden="true">
              {product.emoji}
            </span>
          )}

          <span className="text-[11px] leading-none truncate max-w-[120px]" title={product.name}>
            {product.name}
          </span>

          <button
            type="button"
            onClick={() => onRemove(product)}
            aria-label={`Remove ${product.name}`}
            className="grid place-items-center w-4 h-4 rounded-[3px] shrink-0 transition-colors
                       hover:bg-[var(--color-neutral-800)]"
          >
            <X className="w-3 h-3" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
