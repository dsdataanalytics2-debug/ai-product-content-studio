import { AppError, classifyHttpError, toAppError } from '../utils/errors'
import { stripHtml } from '../utils/text'
import { DEMO_PRODUCTS } from '../config/demoProducts'
import { useApiStore } from '../store/useApiStore'
import { useCatalogStore } from '../store/useCatalogStore'
import { detectApi, fetchPage } from './customApiService'

/**
 * WooCommerce **Store API** → NormalisedProduct.
 *
 * `/wp-json/wc/store/v1/products` is WooCommerce's public headless-storefront
 * API: no consumer key, no secret, nothing to create in wp-admin. It exposes
 * published products only, which is exactly the set you would write ads for.
 *
 * The authenticated `/wc/v3` API buys you SKUs on every product and access to
 * drafts. Nothing here uses it, but the `/wc-api` proxy route is still wired up
 * in vite.config.js if you ever add a consumer key/secret pair.
 *
 * Products are synced into useCatalogStore once and searched locally after
 * that; this module owns the fetching and normalising, not the storage.
 */

const PER_PAGE = 100 // Store API maximum
const MAX_PAGES = 40 // 4,000 products — a guard against a runaway loop, not a real limit

/**
 * Description limits, and why they matter more than they look.
 *
 * The catalogue is persisted to localStorage, which is ~5 MB per origin. A real
 * store's product descriptions are long HTML — measured against woocommerce.com
 * it was 15 KB per product, so 1,547 products projected to **23 MB**. The write
 * throws, the catalogue silently doesn't persist, and everything vanishes on
 * reload.
 *
 * Truncating costs nothing, because promptBuilder already does
 * `truncate(shortDescription || description, 400)` — anything beyond ~400 chars
 * was never going to reach the model. This takes the same store to ~1.5 MB.
 */
const MAX_DESCRIPTION = 600
const MAX_SHORT_DESCRIPTION = 400

/** Emoji stand-ins by category, so the grid reads before images load. */
const CATEGORY_EMOJI = [
  [/skin|beauty|cosmet|serum|cream|lotion/i, '✨'],
  [/hair|shampoo|oil/i, '🧴'],
  [/audio|earbud|headphone|speaker/i, '🎧'],
  [/fan|cool|air/i, '🌀'],
  [/phone|mobile|tablet/i, '📱'],
  [/electron|gadget|device|charger|light/i, '🔌'],
  [/shoe|sandal|sneaker/i, '👟'],
  [/fashion|apparel|cloth|kurti|shirt|saree|dress/i, '👗'],
  [/watch|jewel|ring|necklace/i, '⌚'],
  [/food|snack|spice|tea|coffee|honey/i, '🍽️'],
  [/kitchen|bottle|cook|home|furnitur/i, '🍶'],
  [/book|stationer|pen/i, '📚'],
  [/baby|kid|toy/i, '🧸'],
  [/health|supplement|vitamin|medicine/i, '💊'],
  [/bag|wallet|luggage/i, '👜'],
]

const emojiFor = (categories, name) => {
  const haystack = `${categories.join(' ')} ${name}`
  return CATEGORY_EMOJI.find(([re]) => re.test(haystack))?.[1] ?? '📦'
}

/**
 * The Store API returns money in MINOR units as a string, with the decimal
 * places in a sibling field: `{ price: "125000", currency_minor_unit: 2 }` is
 * 1250.00. Reading `price` directly is the single easiest mistake to make here
 * and produces prices 100× too large in every generated script.
 */
function formatMoney(minorAmount, prices) {
  if (minorAmount == null || minorAmount === '') return null

  const minorUnit = Number(prices?.currency_minor_unit ?? 2)
  const value = Number(minorAmount) / 10 ** minorUnit
  if (!Number.isFinite(value)) return null

  // currency_symbol arrives HTML-encoded (৳ is "&#2547;"), so decode it.
  const symbol = stripHtml(prices?.currency_symbol ?? '') || prices?.currency_code || ''

  const formatted = value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : minorUnit,
    maximumFractionDigits: minorUnit,
  })

  const prefix = prices?.currency_prefix != null ? stripHtml(prices.currency_prefix) : symbol
  const suffix = prices?.currency_suffix != null ? stripHtml(prices.currency_suffix) : ''

  return `${prefix}${formatted}${suffix}`.trim() || `${symbol}${formatted}`
}

/** Cuts at a word boundary — a description severed mid-word reads as corruption
 *  to the model as much as to a person. */
const clip = (text, max) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`

/** Store API shape → NormalisedProduct. */
export function normaliseStoreProduct(raw) {
  const categories = (raw.categories ?? []).map((c) => c.name).filter(Boolean)
  const prices = raw.prices ?? {}

  const regular = formatMoney(prices.regular_price, prices)
  const current = formatMoney(prices.price, prices)
  const onSale = Boolean(raw.on_sale && regular && current && regular !== current)

  return {
    id: String(raw.id),
    name: stripHtml(raw.name ?? '') || 'Untitled product',
    sku: raw.sku || '—',
    // `price` on a normalised product always means the headline/original price,
    // and salePrice the discounted one — so the prompt builder can say
    // "X (was Y) — ON SALE" without knowing which API produced it.
    price: (onSale ? regular : current) ?? '—',
    salePrice: onSale ? current : null,
    currency: prices.currency_code ?? 'BDT',
    emoji: emojiFor(categories, raw.name ?? ''),
    image: raw.images?.[0]?.thumbnail ?? raw.images?.[0]?.src ?? null,
    categories,
    attributes: (raw.attributes ?? [])
      .map((a) => {
        const terms = (a.terms ?? []).map((t) => t.name).filter(Boolean).join(', ')
        return terms ? `${a.name}: ${terms}` : null
      })
      .filter(Boolean),
    shortDescription: clip(stripHtml(raw.short_description ?? ''), MAX_SHORT_DESCRIPTION),
    description: clip(stripHtml(raw.description ?? ''), MAX_DESCRIPTION),
    stockStatus: raw.is_in_stock === false ? 'outofstock' : 'instock',
    permalink: raw.permalink ?? null,
  }
}

export const storeUrlConfigured = () => Boolean(useApiStore.getState().keys.storeUrl)

/** The placeholder shipped in .env.example, and the shapes people paste by
 *  mistake. Catching these here turns an inscrutable DNS failure into a
 *  sentence that says what to do. */
const PLACEHOLDER_HOSTS = ['your-store.com', 'yourstore.com', 'example.com', 'your-site.com']

/**
 * Validates the store URL and returns the header the dev proxy routes on.
 * Throws an AppError with an actionable message rather than letting the request
 * fail somewhere in Node's DNS resolver.
 */
function storeHeaders() {
  const raw = (useApiStore.getState().keys.storeUrl ?? '').trim()

  if (!raw) throw new AppError('NO_STORE', 'Enter your store URL in Settings first.')

  let url
  try {
    url = new URL(raw)
  } catch {
    throw new AppError(
      'NO_STORE',
      `"${raw}" is not a valid URL. It should look like https://yourstore.com`,
    )
  }

  if (PLACEHOLDER_HOSTS.includes(url.hostname)) {
    throw new AppError(
      'NO_STORE',
      `${url.hostname} is the example placeholder, not a real store. Replace it with your own domain in Settings.`,
    )
  }

  const isLocal = ['localhost', '127.0.0.1'].includes(url.hostname)
  if (url.protocol !== 'https:' && !isLocal) {
    throw new AppError('NO_STORE', 'The store URL must start with https://')
  }

  return { 'x-store-target': url.origin }
}

/** True when we're serving bundled demo data because nothing has been synced. */
export const isDemoMode = () => useCatalogStore.getState().products.length === 0

/**
 * Pulls the whole catalogue, page by page, into useCatalogStore.
 *
 * `onPage` is called after each page so the UI can show real progress rather
 * than an indeterminate spinner — on a 2,000-product store this takes a while,
 * and a bar that moves is the difference between "working" and "hung".
 */
/**
 * Syncs from a custom products API (anything that isn't WooCommerce).
 *
 * The shape is detected once and cached on the catalogue store, so re-syncs
 * skip the probing. If a re-sync fails on the cached shape — the API changed,
 * or the key rotated — detection runs again rather than leaving the user stuck.
 */
async function syncCustomApi({ signal, onPage }) {
  const { storeUrl, storeApiKey } = useApiStore.getState().keys
  const origin = new URL(storeUrl).origin

  const catalog = useCatalogStore.getState()
  catalog.startSync(origin)

  let shape = catalog.apiShape
  const cachedShapeMatches = shape?.origin === origin

  if (!cachedShapeMatches) {
    // A full URL with a path is a strong hint about where products live.
    const hintPath = new URL(storeUrl).pathname.replace(/\/+$/, '')
    shape = await detectApi({
      origin,
      apiKey: storeApiKey,
      hintPath: hintPath && hintPath !== '/' ? hintPath : null,
    })
  }

  const all = []
  let totalPages = null

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    let batch
    try {
      batch = await fetchPage({ shape, apiKey: storeApiKey, page, perPage: PER_PAGE, signal })
    } catch (err) {
      // Cached shape may be stale — re-detect once, then give up honestly.
      if (page === 1 && cachedShapeMatches) {
        shape = await detectApi({ origin, apiKey: storeApiKey })
        batch = await fetchPage({ shape, apiKey: storeApiKey, page, perPage: PER_PAGE, signal })
      } else {
        throw err
      }
    }

    all.push(...batch.products)

    if (totalPages == null && batch.total) totalPages = Math.ceil(batch.total / PER_PAGE)

    onPage?.({ page, fetched: all.length, total: batch.total })
    useCatalogStore.getState().reportProgress({ page, fetched: all.length, total: batch.total })

    if (batch.products.length < PER_PAGE) break
    if (totalPages && page >= totalPages) break
  }

  return { products: all, shape }
}

/**
 * Stores the result and confirms it survived the trip to localStorage.
 *
 * zustand's persist write is fire-and-forget — if it exceeds the storage quota
 * the in-memory state still says "1,547 synced" while localStorage holds
 * nothing, and the catalogue evaporates on the next reload. Better to say so now
 * than to let them find out later.
 */
function commitCatalog(products, shape) {
  // De-duplicate by id: a store that ignores `page` would otherwise return page
  // 1 forever and we'd import the same products forty times.
  const unique = [...new Map(products.map((p) => [p.id, p])).values()]
  useCatalogStore.getState().finishSync(unique, shape)

  if (!useCatalogStore.getState().verifyPersisted()) {
    throw new AppError(
      'QUOTA_EXCEEDED',
      `Imported ${unique.length} products, but they were too large for browser storage and will be lost on reload. Free space by exporting and clearing old scripts in Settings → Data.`,
    )
  }

  return unique
}

/** The WooCommerce Store API path. Throws if the site isn't WooCommerce. */
async function syncWooCommerce({ signal, onPage, headers, storeUrl }) {
  const catalog = useCatalogStore.getState()
  catalog.startSync(storeUrl)

  const all = []
  let totalPages = null

  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      per_page: String(PER_PAGE),
      page: String(page),
      // catalog_visibility excludes products hidden from the shop, which are
      // usually variations or add-ons you would not write an ad for.
      catalog_visibility: 'catalog',
    })

    const res = await fetch(`/wc-store/products?${params}`, { signal, headers })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      if (page === 1) throw firstPageError(res.status, storeUrl, body)
      throw classifyHttpError(res.status, body)
    }

    const batch = await res.json()
    if (!Array.isArray(batch)) throw new AppError('PARSE_FAILED', 'Store returned an unexpected shape.')

    all.push(...batch.map(normaliseStoreProduct))

    if (totalPages == null) {
      totalPages = Number(res.headers.get('X-WP-TotalPages')) || null
    }
    const total = Number(res.headers.get('X-WP-Total')) || null

    onPage?.({ page, fetched: all.length, total })
    catalog.reportProgress({ page, fetched: all.length, total })

    // Stop on a short page even if the headers lied or weren't exposed.
    if (batch.length < PER_PAGE) break
    if (totalPages && page >= totalPages) break
  }

  return commitCatalog(all)
}

/** True for the errors that mean "this isn't a WooCommerce store" rather than
 *  "the network is broken" — the only case worth re-probing adaptively. */
const notWooCommerce = (err) =>
  err?.code === 'NO_STORE' || err?.code === 'PARSE_FAILED' || err?.status === 404

export async function syncCatalog({ signal, onPage } = {}) {
  // Validate before touching the network — a bad URL should be a sentence,
  // not an ENOTFOUND stack trace in the terminal.
  const headers = storeHeaders()
  const storeUrl = headers['x-store-target']

  // Route by what the site actually is. A cached custom-API shape, or a saved
  // API key, both mean "not WooCommerce" — skip straight to the adaptive path
  // rather than probing /wp-json first and reporting a confusing 404.
  const catalogState = useCatalogStore.getState()
  const looksCustom =
    catalogState.apiShape?.origin === storeUrl || Boolean(useApiStore.getState().keys.storeApiKey)

  try {
    if (looksCustom) {
      const { products, shape } = await syncCustomApi({ signal, onPage })
      return commitCatalog(products, shape)
    }

    try {
      return await syncWooCommerce({ signal, onPage, headers, storeUrl })
    } catch (wooErr) {
      // Not WooCommerce. Rather than reporting a missing /wp-json endpoint —
      // which means nothing to someone running a bespoke backend — probe for a
      // products API the adaptive way. A public catalogue with no key at all is
      // an ordinary setup, and used to dead-end here.
      if (wooErr?.name === 'AbortError' || !notWooCommerce(wooErr)) throw wooErr

      console.info('[productService] not WooCommerce, probing for a custom products API')
      const { products, shape } = await syncCustomApi({ signal, onPage })
      return commitCatalog(products, shape)
    }
  } catch (err) {
    if (err?.name === 'AbortError') {
      useCatalogStore.getState().failSync(new AppError('ABORTED'))
      throw err
    }
    console.error('[productService] syncCatalog failed', err)
    const appError = toAppError(err)
    useCatalogStore.getState().failSync(appError)
    throw appError
  }
}

/**
 * Turns a first-page HTTP status into something actionable. Vite's proxy
 * reports an unreachable or unresolvable host as a 500 or 504, which on its own
 * tells the user nothing — this is where "ENOTFOUND your-store.com" becomes a
 * sentence about their domain.
 */
function firstPageError(status, storeUrl, body) {
  const host = storeUrl.replace(/^https?:\/\//, '')

  // The dev proxy already diagnosed the failure (DNS, TLS, timeout, refused)
  // and put a readable sentence in `message`. Prefer it over anything we could
  // reconstruct from the status code alone.
  if (body?.message && (status === 400 || status === 502))
    return new AppError(status === 400 ? 'NO_STORE' : 'NETWORK', body.message, { status })

  if (status === 500 || status === 502 || status === 504)
    return new AppError(
      'NETWORK',
      `Could not reach ${host}. Check the domain is spelled correctly and the site is online.`,
      { status },
    )

  if (status === 404)
    return new AppError(
      'NO_STORE',
      `${host} responded, but has no Store API at /wp-json/wc/store/v1. It may not be WooCommerce, or WooCommerce may be older than 6.0.`,
      { status },
    )

  if (status === 401 || status === 403)
    return new AppError(
      'AUTH_FAILED',
      `${host} refused the request. The Store API is normally public — a security plugin or firewall may be blocking /wp-json.`,
      { status },
    )

  return classifyHttpError(status, null)
}

/** Reachability probe — one product, so the button answers fast. */
export async function testStoreConnection() {
  let headers
  try {
    headers = storeHeaders()
  } catch (err) {
    return { status: 'fail', message: toAppError(err).display().body }
  }

  const origin = headers['x-store-target']
  const apiKey = useApiStore.getState().keys.storeApiKey

  // With a key present, this is a private API — probe adaptively rather than
  // reporting "no Store API at /wp-json", which is true but unhelpful.
  if (apiKey) {
    try {
      const shape = await detectApi({ origin, apiKey })
      return {
        status: 'ok',
        message: `Connected via ${shape.path} using ${shape.authLabel}.${
          shape.total ? ` ${shape.total} products available.` : ''
        }`,
      }
    } catch (err) {
      return { status: 'fail', message: toAppError(err).display().body }
    }
  }

  try {
    const res = await fetch('/wc-store/products?per_page=1', { headers })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      // Not WooCommerce — try the adaptive path before giving up, since plenty
      // of stores are a custom backend with no key at all.
      try {
        const shape = await detectApi({ origin, apiKey: null })
        return {
          status: 'ok',
          message: `Connected via ${shape.path}.${
            shape.total ? ` ${shape.total} products available.` : ''
          }`,
        }
      } catch {
        return {
          status: 'fail',
          message: firstPageError(res.status, origin, body).display().body,
        }
      }
    }

    const batch = await res.json()
    if (!Array.isArray(batch))
      return { status: 'fail', message: 'That URL responded, but not with a WooCommerce Store API.' }

    const total = res.headers.get('X-WP-Total')
    return {
      status: 'ok',
      message: total
        ? `Connected. ${total} products available.`
        : 'Connected. Ready to sync.',
    }
  } catch (err) {
    console.error('[productService] testStoreConnection failed', err)
    return { status: 'fail', message: toAppError(err).display().body }
  }
}

/**
 * Searches the synced catalogue, falling back to demo products when nothing has
 * been imported. Synchronous by design — there is no network call here.
 */
export function searchProducts({ search = '', category = '' } = {}) {
  const catalog = useCatalogStore.getState()

  if (catalog.products.length === 0) {
    const needle = search.trim().toLowerCase()
    const matched = DEMO_PRODUCTS.filter((p) => {
      if (category && !p.categories.includes(category)) return false
      if (!needle) return true
      return `${p.name} ${p.sku} ${p.categories.join(' ')}`.toLowerCase().includes(needle)
    })
    return { products: matched, total: matched.length, demo: true }
  }

  const products = catalog.search({ q: search, category })
  return { products, total: products.length, demo: false }
}

export function listCategories() {
  const catalog = useCatalogStore.getState()
  if (catalog.products.length === 0)
    return [...new Set(DEMO_PRODUCTS.flatMap((p) => p.categories))].sort()
  return catalog.categories()
}
