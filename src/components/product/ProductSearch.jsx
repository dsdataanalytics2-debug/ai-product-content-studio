import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Package, RefreshCw } from 'lucide-react'
import ProductCard from './ProductCard'
import ProductGridSkeleton from './ProductGridSkeleton'
import SelectedProducts from './SelectedProducts'
import EmptyState from '../ui/EmptyState'
import Button from '../ui/Button'
import Badge from '../ui/Badge'
import { searchProducts, listCategories } from '../../services/productService'
import { useScriptStore } from '../../store/useScriptStore'
import { useCatalogStore } from '../../store/useCatalogStore'
import { MAX_SELECTED_PRODUCTS } from '../../config/constants'

/**
 * Searches the locally synced catalogue. No network, no debounce, no abort
 * controller — all of that moved to the one-time sync in Settings, which is why
 * typing here is instant and works with the store offline.
 */
export default function ProductSearch({ onContinue }) {
  const selectedProducts = useScriptStore((s) => s.selectedProducts)
  const toggleProduct = useScriptStore((s) => s.toggleProduct)

  const catalogProducts = useCatalogStore((s) => s.products)
  const syncing = useCatalogStore((s) => s.syncing)

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')

  // Recomputed when the catalogue changes, so a sync finishing updates the list
  // underneath the user without a reload.
  const categories = useMemo(() => listCategories(), [catalogProducts])
  const result = useMemo(
    () => searchProducts({ search: query, category }),
    [query, category, catalogProducts],
  )

  const atLimit = selectedProducts.length >= MAX_SELECTED_PRODUCTS
  const selectedIds = new Set(selectedProducts.map((p) => p.id))

  return (
    <div className="flex flex-col gap-2.5 h-full min-h-0">
      <div className="flex items-center justify-between gap-2 shrink-0">
        <h2 className="text-[13px] font-semibold">Select products</h2>
        {result.demo ? (
          <Badge tone="warning">Demo data</Badge>
        ) : (
          <Badge tone="neutral">{catalogProducts.length} synced</Badge>
        )}
      </div>

      <div className="relative shrink-0">
        <Search
          className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none text-faint"
          aria-hidden="true"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search products…"
          aria-label="Search products"
          className="input text-[13px] pl-8"
        />
      </div>

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        aria-label="Filter by category"
        className="input text-[13px] shrink-0"
      >
        <option value="">All categories</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <div className="scroll-y -mx-0.5 px-0.5">
        {syncing && <ProductGridSkeleton />}

        {!syncing && result.products.length === 0 && query && (
          <EmptyState
            icon={Search}
            compact
            title="No products match"
            description={`Nothing found for “${query}”${category ? ' in this category' : ''}. Try a shorter term.`}
            action={
              <Button variant="secondary" size="sm" onClick={() => setQuery('')}>
                Clear search
              </Button>
            }
          />
        )}

        {!syncing && result.products.length === 0 && !query && (
          <EmptyState
            icon={Package}
            compact
            title="No products"
            description="Sync your store in Settings to import your catalogue."
            action={
              <Link to="/settings">
                <Button variant="secondary" size="sm" icon={RefreshCw}>
                  Open Settings
                </Button>
              </Link>
            }
          />
        )}

        {!syncing && result.products.length > 0 && (
          <div className="flex flex-col gap-2">
            {result.products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                selected={selectedIds.has(p.id)}
                onToggle={() => toggleProduct(p)}
                disabled={atLimit}
              />
            ))}
          </div>
        )}
      </div>

      <div className="shrink-0 pt-1">
        {result.demo && !syncing && (
          <p className="text-[11px] text-faint leading-relaxed mb-2">
            These are demo products.{' '}
            <Link to="/settings" className="font-medium">
              Sync your store
            </Link>{' '}
            to use your own.
          </p>
        )}
        <SelectedProducts products={selectedProducts} onRemove={toggleProduct} />

        <p className="text-[11.5px] text-faint mb-2">
          {selectedProducts.length} of {MAX_SELECTED_PRODUCTS} selected
          {atLimit && ' — limit reached'}
        </p>
        <Button
          block
          disabled={selectedProducts.length === 0}
          onClick={onContinue}
          title={selectedProducts.length === 0 ? 'Select at least one product' : undefined}
        >
          Continue →
        </Button>
      </div>
    </div>
  )
}
