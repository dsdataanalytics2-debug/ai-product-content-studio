import { useRef, useState } from 'react'
import { RefreshCw, Trash2, Package, CheckCircle2, XCircle, X } from 'lucide-react'
import Card from '../ui/Card'
import Button from '../ui/Button'
import Input from '../ui/Input'
import Badge from '../ui/Badge'
import { useApiStore } from '../../store/useApiStore'
import { useCatalogStore } from '../../store/useCatalogStore'
import { syncCatalog, testStoreConnection } from '../../services/productService'
import { relativeTime } from '../../utils/text'
import { toast } from '../../store/useToastStore'
import { toAppError } from '../../utils/errors'

/** Origin of a URL, or null while the user is still mid-type. */
const originOf = (raw) => {
  try {
    return new URL(raw).origin
  } catch {
    return null
  }
}

function Row({ label, value, mono = false }) {
  return (
    <div className="flex items-baseline gap-2 text-[11.5px]">
      <span className="text-faint shrink-0">{label}</span>
      <span
        className={`ml-auto text-right truncate ${mono ? 'font-mono text-[11px]' : ''}`}
        style={{ color: 'var(--text-body)' }}
        title={value}
      >
        {value}
      </span>
    </div>
  )
}

export default function StoreSync() {
  const storeUrl = useApiStore((s) => s.keys.storeUrl)
  const setKey = useApiStore((s) => s.setKey)
  const setTestResult = useApiStore((s) => s.setTestResult)
  const testResult = useApiStore((s) => s.testResults.storeUrl)

  const products = useCatalogStore((s) => s.products)
  const lastSyncedAt = useCatalogStore((s) => s.lastSyncedAt)
  const syncedFrom = useCatalogStore((s) => s.syncedFrom)
  const syncing = useCatalogStore((s) => s.syncing)
  const progress = useCatalogStore((s) => s.progress)
  const clearCatalog = useCatalogStore((s) => s.clear)

  const storeApiKey = useApiStore((s) => s.keys.storeApiKey)
  const apiShape = useCatalogStore((s) => s.apiShape)

  const [draft, setDraft] = useState(storeUrl ?? '')
  const [keyDraft, setKeyDraft] = useState(storeApiKey ?? '')
  const [testing, setTesting] = useState(false)
  const abortRef = useRef(null)

  const dirty = draft.trim() !== (storeUrl ?? '') || keyDraft.trim() !== (storeApiKey ?? '')

  // Trailing slashes produce //wp-json paths that some hosts 404 on.
  const commitUrl = () => {
    const cleaned = draft.trim().replace(/\/+$/, '')
    setKey('storeUrl', cleaned)
    setKey('storeApiKey', keyDraft.trim())
    setDraft(cleaned)
    return cleaned
  }

  const test = async () => {
    if (dirty) commitUrl()
    setTesting(true)
    const result = await testStoreConnection()
    setTestResult('storeUrl', result)
    setTesting(false)
    if (result.status === 'ok') toast.success('Store reachable', result.message)
    else toast.error('Could not reach the store', result.message)
  }

  const runSync = async () => {
    if (dirty) commitUrl()

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const imported = await syncCatalog({ signal: controller.signal })
      toast.success(
        `Synced ${imported.length} products`,
        'Search is now instant and works offline. Re-sync after you change your store.',
      )
    } catch (err) {
      if (err?.name === 'AbortError') {
        toast.info('Sync cancelled')
        return
      }
      toast.fromAppError(toAppError(err))
    }
  }

  const cancelSync = () => abortRef.current?.abort()

  const pct =
    progress?.total && progress.total > 0
      ? Math.min(100, Math.round((progress.fetched / progress.total) * 100))
      : null

  // syncedFrom is always a bare origin, while storeUrl is whatever was typed —
  // often a full endpoint URL with a path. Comparing the two as strings marked
  // every such catalogue permanently stale, and no amount of re-syncing cleared
  // the warning.
  const staleUrl = syncedFrom && storeUrl && syncedFrom !== originOf(storeUrl)

  return (
    <Card
      title="Your store"
      subtitle="Reads published products through WooCommerce's public Store API — no consumer key or secret needed."
    >
      <div className="flex flex-col gap-4">
        <Input
          label="Store or API URL"
          value={draft}
          onChange={setDraft}
          placeholder="https://your-store.com"
          error={testResult?.status === 'fail' ? testResult.message : undefined}
          hint={
            testResult?.status === 'ok'
              ? testResult.message
              : 'Your shop address, or the full URL of your products endpoint. Takes effect immediately — no restart.'
          }
        />

        <Input
          label="API key (leave blank for WooCommerce)"
          value={keyDraft}
          onChange={setKeyDraft}
          masked
          mono
          placeholder="Paste your key if your API needs one"
          hint="Only for a private products API. The app works out how to send it — Bearer token, X-API-Key or query parameter — by trying each until one is accepted."
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            icon={RefreshCw}
            loading={syncing}
            disabled={!draft.trim() || syncing}
            onClick={runSync}
          >
            {syncing ? 'Syncing…' : products.length ? 'Re-sync products' : 'Sync products'}
          </Button>

          {syncing ? (
            <Button variant="secondary" size="sm" icon={X} onClick={cancelSync}>
              Cancel
            </Button>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              loading={testing}
              disabled={!draft.trim()}
              onClick={test}
            >
              Test connection
            </Button>
          )}

          {products.length > 0 && !syncing && (
            <Button
              variant="ghost"
              size="sm"
              icon={Trash2}
              onClick={() => {
                clearCatalog()
                toast.info('Catalogue cleared', 'Back to demo products until you sync again.')
              }}
            >
              Clear catalogue
            </Button>
          )}
        </div>

        {/* Progress — real counts, not an indeterminate spinner. A 2,000-product
            store takes a while, and a bar that moves is the difference between
            "working" and "hung". */}
        {syncing && progress && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11.5px]">
              <span className="text-dim">
                Page {progress.page} · {progress.fetched} imported
                {progress.total ? ` of ${progress.total}` : ''}
              </span>
              {pct != null && <span className="text-faint tabular-nums">{pct}%</span>}
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: 'var(--color-neutral-800)' }}
            >
              <div
                className="h-full rounded-full transition-[width]"
                style={{
                  width: pct != null ? `${pct}%` : '35%',
                  background: 'var(--color-accent)',
                }}
              />
            </div>
          </div>
        )}

        {/* Current state */}
        <div
          className="flex items-center gap-2.5 p-2.5 rounded-[var(--radius-md)]"
          style={{
            background: 'var(--color-neutral-900)',
            border: '1px solid var(--color-divider)',
          }}
        >
          <Package className="w-4 h-4 shrink-0 text-faint" aria-hidden="true" />
          <div className="flex-1 min-w-0">
            {products.length > 0 ? (
              <>
                <p className="text-[12.5px] font-medium">
                  {products.length} products in the catalogue
                </p>
                <p className="text-[11px] text-faint">
                  Last synced {relativeTime(lastSyncedAt)}
                  {syncedFrom ? ` from ${syncedFrom.replace(/^https?:\/\//, '')}` : ''}
                </p>
              </>
            ) : (
              <>
                <p className="text-[12.5px] font-medium">Using demo products</p>
                <p className="text-[11px] text-faint">
                  Six bundled products so every screen works. Sync to replace them with yours.
                </p>
              </>
            )}
          </div>
          {products.length > 0 ? (
            <Badge tone="success">
              <CheckCircle2 className="w-3 h-3" /> Synced
            </Badge>
          ) : (
            <Badge tone="neutral">Demo</Badge>
          )}
        </div>

        {/* What auto-detection actually found. Shown because a mapping you
            can't see is a mapping you can't correct — if the wrong field became
            "price", this is where you'd notice. */}
        {apiShape && products.length > 0 && (
          <details
            className="rounded-[var(--radius-md)] overflow-hidden"
            style={{ border: '1px solid var(--color-divider)' }}
          >
            <summary className="px-2.5 py-2 text-[12px] cursor-pointer select-none text-dim">
              How your API was read
            </summary>
            <div className="px-2.5 pb-2.5 flex flex-col gap-1.5">
              <Row label="Endpoint" value={`${apiShape.path}`} mono />
              <Row label="Authentication" value={apiShape.authLabel} />
              <Row label="Products found in" value={apiShape.arrayPath} mono />
              {Object.entries(apiShape.mapping ?? {}).length > 0 && (
                <>
                  <p className="eyebrow mt-1.5">Field mapping</p>
                  {Object.entries(apiShape.mapping).map(([field, source]) => (
                    <Row key={field} label={field} value={source} mono />
                  ))}
                </>
              )}
              <p className="text-[10.5px] text-faint leading-relaxed mt-1.5">
                If something is mapped to the wrong field, tell me the correct name and I&apos;ll
                pin it rather than guessing.
              </p>
            </div>
          </details>
        )}

        {staleUrl && (
          <p
            className="flex items-start gap-1.5 text-[11.5px] leading-relaxed"
            style={{ color: 'var(--color-warning-text)' }}
          >
            <XCircle className="w-3.5 h-3.5 shrink-0 mt-px" aria-hidden="true" />
            These products came from {syncedFrom.replace(/^https?:\/\//, '')}, but the URL above has
            changed. Re-sync to replace them.
          </p>
        )}

        <p className="text-[11px] text-faint leading-relaxed">
          Products are imported once and searched locally, so the Studio stays fast and works
          offline. The catalogue is a snapshot — re-sync after you change prices or add products.
          The Store API returns published products only; drafts and SKU-only fields need the
          authenticated REST API.
        </p>
      </div>
    </Card>
  )
}
