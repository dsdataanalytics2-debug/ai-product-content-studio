import { ChevronRight } from 'lucide-react'
import Badge from '../ui/Badge'
import { useAvailableProviders } from '../../store/useApiStore'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { PROVIDERS } from '../../config/models'

/**
 * The top bar carries the connection status because "is my key working" is the
 * question people ask most, and making them open Settings to find out is the
 * kind of small friction that adds up.
 */
export default function Navbar({ breadcrumb = [], actions }) {
  const availableProviders = useAvailableProviders()
  // Demo mode is now about whether a catalogue has been synced, not whether
  // credentials exist — you can have a store URL saved and still not have
  // imported anything.
  const syncedCount = useCatalogStore((s) => s.products.length)
  const preferred = useSettingsStore((s) => s.preferredProvider)

  const activeProvider = availableProviders.includes(preferred)
    ? preferred
    : availableProviders[0]

  return (
    <header
      className="flex items-center justify-between gap-3 h-[52px] shrink-0 px-5"
      style={{ borderBottom: '1px solid var(--color-divider)' }}
    >
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-[13px]">
        {breadcrumb.map((crumb, i) => (
          <span key={crumb} className="flex items-center gap-1.5 min-w-0">
            {i > 0 && <ChevronRight className="w-3 h-3 shrink-0 text-faint" aria-hidden="true" />}
            <span
              className="truncate"
              style={{
                color: i === breadcrumb.length - 1 ? 'var(--color-text)' : 'var(--text-dim)',
                fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
              }}
            >
              {crumb}
            </span>
          </span>
        ))}
      </nav>

      <div className="flex items-center gap-2 shrink-0">
        {/* Status badges are context, not controls — they are the first thing to
            drop when the bar gets tight, so the page action always survives. */}
        <span className="hidden md:flex items-center gap-2">
          {activeProvider ? (
            <Badge tone="success" dot>
              {PROVIDERS[activeProvider].label} connected
            </Badge>
          ) : (
            <Badge tone="warning">No AI provider</Badge>
          )}
          {syncedCount === 0 && <Badge tone="neutral">Demo products</Badge>}
        </span>
        {actions}
      </div>
    </header>
  )
}
