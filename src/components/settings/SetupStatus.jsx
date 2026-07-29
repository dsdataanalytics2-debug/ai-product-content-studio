import { Link } from 'react-router-dom'
import { CheckCircle2, Circle, ShieldAlert } from 'lucide-react'
import { useApiStore, useAvailableProviders } from '../../store/useApiStore'
import { useCatalogStore } from '../../store/useCatalogStore'
import { useBrandStore } from '../../store/useBrandStore'

/** Reads useApiStore.keys + testResults. No props. */
export default function SetupStatus() {
  const keys = useApiStore((s) => s.keys)
  const providers = useAvailableProviders()
  const hasStore = useApiStore((s) => s.hasStore())
  const syncedCount = useCatalogStore((s) => s.products.length)
  const brandCount = useBrandStore((s) => s.brands.length)

  const steps = [
    {
      done: providers.length > 0,
      label: 'An AI provider key',
      detail: providers.length
        ? `${providers.length} configured`
        : 'Required — nothing generates without one',
      required: true,
    },
    {
      done: syncedCount > 0,
      label: 'Your product catalogue',
      detail:
        syncedCount > 0
          ? `${syncedCount} products synced`
          : hasStore
            ? 'URL saved — press Sync products to import'
            : 'Optional — demo products work without it',
      required: false,
    },
    {
      done: brandCount > 0,
      label: 'A brand profile',
      detail: brandCount ? `${brandCount} saved` : 'Optional — keeps tone consistent across scripts',
      required: false,
      to: '/brands',
    },
    {
      done: Boolean(keys.elevenLabsKey || keys.googleTtsKey),
      label: 'A voice provider',
      detail: 'Optional — browser TTS previews for free',
      required: false,
    },
  ]

  const blocked = steps.filter((s) => s.required && !s.done)

  return (
    <div className="card elev-sm p-4 flex flex-col gap-3">
      <div>
        <h2 className="text-[13px] font-semibold">Setup</h2>
        <p className="text-[11.5px] text-faint mt-0.5">
          {blocked.length === 0
            ? 'Everything required is in place.'
            : `${blocked.length} required item left.`}
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {steps.map((s) => (
          <li key={s.label} className="flex items-start gap-2">
            {s.done ? (
              <CheckCircle2
                className="w-4 h-4 shrink-0 mt-px"
                style={{ color: 'var(--color-success)' }}
                aria-hidden="true"
              />
            ) : (
              <Circle
                className="w-4 h-4 shrink-0 mt-px"
                style={{ color: s.required ? 'var(--color-warning)' : 'var(--text-faint)' }}
                aria-hidden="true"
              />
            )}
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium leading-snug">
                {s.to ? <Link to={s.to}>{s.label}</Link> : s.label}
                {s.required && !s.done && (
                  <span className="text-[10.5px] font-normal" style={{ color: 'var(--color-warning-text)' }}>
                    {' '}
                    · required
                  </span>
                )}
              </p>
              <p className="text-[11px] text-faint">{s.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div
        className="flex items-start gap-2 p-2.5 rounded-[var(--radius-md)]"
        style={{
          background: 'color-mix(in srgb, var(--color-warning) 8%, transparent)',
          border: '1px solid color-mix(in srgb, var(--color-warning) 20%, transparent)',
        }}
      >
        <ShieldAlert
          className="w-3.5 h-3.5 shrink-0 mt-px"
          style={{ color: 'var(--color-warning-text)' }}
          aria-hidden="true"
        />
        <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-warning-text)' }}>
          Keys are stored unencrypted in this browser&apos;s localStorage, so any script on this
          origin can read them. That is fine on your own machine and wrong for a shared or public
          deployment — for that, put the keys behind the Cloudflare Worker proxy instead.
        </p>
      </div>
    </div>
  )
}
