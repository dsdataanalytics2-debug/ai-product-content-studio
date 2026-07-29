import { AppError, toAppError } from '../utils/errors'
import { stripHtml } from '../utils/text'

/**
 * Adaptive fetcher for a custom products API.
 *
 * Built for the case where someone has "an API key and a URL" and reasonably
 * does not know their own backend's auth header, envelope shape, or field
 * names. Rather than making that their problem, this probes:
 *
 *   1. which path serves products      (/api/v1/products, /products, …)
 *   2. which auth scheme is accepted   (Bearer, X-API-Key, query param)
 *   3. where the array lives           (root, data, data.products, items, …)
 *   4. what the fields are called      (name|title, price|amount, …)
 *
 * The detected shape is returned alongside the products so the UI can show what
 * it found. Auto-detection that silently guesses wrong is worse than no
 * auto-detection — you have to be able to see the mapping to know it's right.
 */

const CANDIDATE_PATHS = [
  '/api/v1/products',
  '/api/products',
  '/api/v1/product',
  '/products',
  '/v1/products',
  '/api/v2/products',
  '/wp-json/wc/store/v1/products',
]

const AUTH_SCHEMES = [
  { id: 'bearer', label: 'Authorization: Bearer', headers: (k) => ({ authorization: `Bearer ${k}` }) },
  { id: 'x-api-key', label: 'X-API-Key', headers: (k) => ({ 'x-api-key': k }) },
  { id: 'token', label: 'Authorization: Token', headers: (k) => ({ authorization: `Token ${k}` }) },
  { id: 'raw', label: 'Authorization (raw key)', headers: (k) => ({ authorization: k }) },
  { id: 'query', label: 'api_key query param', headers: () => ({}), query: (k) => ({ api_key: k }) },
  { id: 'none', label: 'No authentication', headers: () => ({}) },
]

/** Field aliases, most specific first. */
const FIELDS = {
  id: ['id', '_id', 'productId', 'product_id', 'uuid', 'sku'],
  name: ['name', 'title', 'productName', 'product_name', 'label'],
  sku: ['sku', 'code', 'productCode', 'product_code', 'barcode'],
  price: ['regularPrice', 'regular_price', 'price', 'mrp', 'listPrice', 'list_price', 'amount'],
  salePrice: ['salePrice', 'sale_price', 'discountPrice', 'discount_price', 'offerPrice', 'specialPrice'],
  description: ['description', 'details', 'longDescription', 'long_description', 'body', 'content'],
  shortDescription: [
    'shortDescription',
    'short_description',
    'shortDesc',
    'short_desc',
    'summary',
    'excerpt',
    'subtitle',
    'tagline',
  ],
  image: [
    'image',
    'thumbnail',
    'imageUrl',
    'image_url',
    'coverImg',
    'coverImage',
    'cover_image',
    'photo',
    'featuredImage',
    'featured_image',
  ],
  images: ['images', 'gallery', 'photos', 'media'],
  categories: ['categories', 'category', 'tags', 'collections', 'categoryName', 'category_name'],
  stock: ['stockStatus', 'stock_status', 'inStock', 'in_stock', 'stock', 'quantity', 'availability'],
  currency: ['currency', 'currencyCode', 'currency_code'],
}

/** Every key that might carry a category name, unioned rather than first-match —
 *  a product's sub-category is as useful to the prompt as its category. */
const CATEGORY_KEYS = [
  'categories',
  'category',
  'SubCategory',
  'subCategory',
  'sub_category',
  'subcategory',
  'tags',
  'collections',
  'categoryName',
  'category_name',
]

/** Arrays that carry per-option pricing. Shopify nests price this way, and so
 *  do most bespoke storefront APIs. */
const VARIANT_KEYS = ['variants', 'options', 'skus']

/** Assumed when an API states no currency, matching the rest of the app. */
const DEFAULT_CURRENCY = 'BDT'

const pick = (obj, aliases) => {
  for (const key of aliases) {
    const value = obj?.[key]
    if (value === undefined || value === null || value === '') continue
    // An empty array is an absent value, not a present one. Treating `images: []`
    // as a hit stops the search before reaching a populated `coverImg`.
    if (Array.isArray(value) && value.length === 0) continue
    return { key, value }
  }
  return null
}

/** Finds the first array of objects anywhere shallow in the response. */
function findProductArray(payload, path = '') {
  if (Array.isArray(payload)) {
    return payload.length === 0 || typeof payload[0] === 'object'
      ? { array: payload, path: path || '(root)' }
      : null
  }
  if (!payload || typeof payload !== 'object') return null

  // Conventional wrappers first, so `data` wins over some unrelated array.
  const preferred = ['data', 'products', 'items', 'results', 'records', 'rows', 'list', 'docs']
  for (const key of preferred) {
    if (key in payload) {
      const found = findProductArray(payload[key], path ? `${path}.${key}` : key)
      if (found) return found
    }
  }
  for (const [key, value] of Object.entries(payload)) {
    if (preferred.includes(key)) continue
    const found = findProductArray(value, path ? `${path}.${key}` : key)
    if (found) return found
  }
  return null
}

/** Pagination metadata, wherever the API happens to put it. */
function findTotal(payload) {
  const candidates = [
    payload?.total,
    payload?.totalCount,
    payload?.total_count,
    payload?.count,
    payload?.meta?.total,
    payload?.meta?.totalCount,
    payload?.pagination?.total,
    payload?.pagination?.totalCount,
    payload?.data?.total,
    payload?.totalItems,
  ]
  const total = candidates.find((v) => Number.isFinite(Number(v)) && Number(v) > 0)
  return total != null ? Number(total) : null
}

function buildUrl(origin, path, params) {
  const search = new URLSearchParams(params)
  const query = search.toString()
  // Always through the dev proxy — a private API will not send CORS headers.
  return `/upstream${path}${query ? `?${query}` : ''}`
}

async function attempt(origin, path, scheme, apiKey, extraParams = {}) {
  const params = { ...extraParams, ...(scheme.query && apiKey ? scheme.query(apiKey) : {}) }
  const url = buildUrl(origin, path, params)

  const res = await fetch(url, {
    headers: {
      'x-store-target': origin,
      ...(apiKey ? scheme.headers(apiKey) : {}),
    },
  })

  const body = await res.json().catch(() => null)
  return { res, body }
}

/**
 * Works out how to talk to the API. Returns a `shape` describing everything it
 * discovered, which the caller stores so later syncs skip the probing.
 */
export async function detectApi({ origin, apiKey, hintPath }) {
  const paths = hintPath ? [hintPath, ...CANDIDATE_PATHS] : CANDIDATE_PATHS
  const schemes = apiKey ? AUTH_SCHEMES : [AUTH_SCHEMES.find((s) => s.id === 'none')]

  let sawUnauthorized = false
  let sawServerError = false
  let lastMessage = null

  for (const path of [...new Set(paths)]) {
    for (const scheme of schemes) {
      let result
      try {
        result = await attempt(origin, path, scheme, apiKey, { limit: 1, per_page: 1 })
      } catch (err) {
        throw toAppError(err)
      }

      const { res, body } = result

      if (res.status === 401 || res.status === 403) {
        sawUnauthorized = true
        lastMessage = body?.message ?? null
        continue // right path, wrong auth — try the next scheme
      }
      if (!res.ok) {
        lastMessage = body?.message ?? `HTTP ${res.status}`
        // Some APIs throw a 500 on a malformed token instead of returning 401.
        // Combined with a 401 on the keyless attempt, that means the endpoint is
        // right and the key is wrong — worth saying, rather than reporting "no
        // products endpoint found".
        if (res.status >= 500 && apiKey) sawServerError = true
        // 404 means wrong path; stop trying auth schemes against it.
        if (res.status === 404) break
        continue
      }

      const found = findProductArray(body)
      if (!found) {
        lastMessage = 'Responded, but no list of products was found in the reply.'
        continue
      }

      const sample = found.array[0]
      if (!sample) {
        // Empty list is a valid answer — the API works, the catalogue is empty.
        return {
          origin,
          path,
          authScheme: scheme.id,
          authLabel: scheme.label,
          arrayPath: found.path,
          total: findTotal(body),
          sample: null,
          mapping: {},
        }
      }

      return {
        origin,
        path,
        authScheme: scheme.id,
        authLabel: scheme.label,
        arrayPath: found.path,
        total: findTotal(body),
        sample,
        mapping: describeMapping(sample),
      }
    }
  }

  if (sawUnauthorized || sawServerError)
    throw new AppError(
      'AUTH_FAILED',
      sawServerError
        ? 'Found your products endpoint, but the key was not accepted — the API errored on it. Check the key was copied in full, with no missing characters or extra spaces.'
        : lastMessage
          ? `The API rejected the key (${lastMessage}). Check it was copied in full.`
          : 'Found your products endpoint, but the API key was rejected. Check it was copied in full, with no extra spaces.',
    )

  throw new AppError(
    'NO_STORE',
    `Could not find a products endpoint on ${origin.replace(/^https?:\/\//, '')}. ${
      lastMessage ?? 'Tried the usual paths without success.'
    } If you know the exact path, enter the full URL to it.`,
  )
}

/** Which source field each app field came from — shown in the UI. */
function describeMapping(sample) {
  const mapping = {}
  const variant = cheapestVariant(sample)

  for (const [field, aliases] of Object.entries(FIELDS)) {
    const hit = pick(sample, aliases)
    if (hit) {
      mapping[field] = hit.key
      continue
    }
    // Show where a field was really found, so a price sourced from a variant
    // reads as such in Settings rather than appearing unmapped.
    const nested = variant && pick(variant, aliases)
    if (nested) mapping[field] = `variants[].${nested.key}`
  }
  return mapping
}

/**
 * Prices arrive as `49`, `"49.00"`, `"$49"`, `4900` (minor units), or
 * `{ amount, currency }`. Getting this wrong is the bug that silently 100×'s
 * every price in a generated ad, so it is handled explicitly.
 */
function readMoney(raw, currency) {
  if (raw == null || raw === '') return null

  if (typeof raw === 'object') {
    const inner = pick(raw, ['amount', 'value', 'price', 'formatted', 'display'])
    if (!inner) return null
    return readMoney(inner.value, currency ?? raw.currency ?? raw.currency_code)
  }

  // Already formatted by the API — trust it rather than re-deriving.
  if (typeof raw === 'string' && /[^\d.,\s-]/.test(raw)) return raw.trim()

  const value = Number(String(raw).replace(/[,\s]/g, ''))
  if (!Number.isFinite(value)) return null

  const symbol = { BDT: '৳', USD: '$', EUR: '€', GBP: '£', INR: '₹' }[currency] ?? ''
  return `${symbol}${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function readImage(raw) {
  if (!raw) return null
  if (typeof raw === 'string') return raw
  if (Array.isArray(raw)) return readImage(raw[0])
  if (typeof raw === 'object')
    return pick(raw, ['thumbnail', 'src', 'url', 'image', 'path', 'link'])?.value ?? null
  return null
}

function readList(raw) {
  if (!raw) return []
  if (typeof raw === 'string') return [raw]
  if (!Array.isArray(raw)) {
    if (typeof raw === 'object') return [pick(raw, ['name', 'title', 'label'])?.value].filter(Boolean)
    return []
  }
  return raw
    .map((item) =>
      typeof item === 'string' ? item : pick(item, ['name', 'title', 'label'])?.value,
    )
    .filter(Boolean)
}

const clip = (text, max) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, '')}…`

/** Lowest real price a variant offers, for choosing between them. */
function variantFrom(variant) {
  const sale = Number(pick(variant, FIELDS.salePrice)?.value)
  const price = Number(pick(variant, FIELDS.price)?.value)
  if (Number.isFinite(sale) && sale > 0) return sale
  return Number.isFinite(price) && price > 0 ? price : Infinity
}

/**
 * The variant a shopper would see quoted — the cheapest one.
 *
 * Products whose price lives only on their variants are common enough that
 * ignoring them means importing a whole catalogue priced "—". Where variants
 * differ, the lowest is the "from" price every storefront leads with; where they
 * are identical it collapses to the first, which is what you would have picked
 * anyway.
 */
function cheapestVariant(raw) {
  for (const key of VARIANT_KEYS) {
    const list = raw?.[key]
    if (!Array.isArray(list) || list.length === 0) continue

    const priced = list.filter((v) => v && (pick(v, FIELDS.price) || pick(v, FIELDS.salePrice)))
    if (priced.length === 0) continue

    return priced.reduce((best, v) => (variantFrom(v) < variantFrom(best) ? v : best))
  }
  return null
}

/**
 * Stock level, including the nested inventory shape where a variant holds a
 * per-warehouse breakdown rather than a single number.
 */
function readStock(source) {
  const direct = pick(source, FIELDS.stock)
  if (direct) return direct.value

  const inventory = source?.Inventory ?? source?.inventory
  if (!inventory) return undefined

  const warehouses = inventory.warehouseStocks ?? inventory.stocks ?? inventory.locations
  if (Array.isArray(warehouses))
    return warehouses.reduce((total, w) => total + (Number(w?.quantity) || 0), 0)

  const quantity = Number(inventory.quantity)
  return Number.isFinite(quantity) ? quantity : undefined
}

/** Category names from every key that might hold one, de-duplicated. */
function readCategories(raw) {
  const names = CATEGORY_KEYS.flatMap((key) => readList(raw?.[key]))
  return [...new Set(names.filter(Boolean))]
}

/** Any product shape → NormalisedProduct, using the detected mapping. */
export function normaliseCustomProduct(raw, index = 0) {
  // Resolve the fallback before formatting, not after. Plenty of APIs omit the
  // currency entirely, and reading it as undefined here produced "1,500" while
  // the product still reported its currency as BDT — a bare number in an ad.
  const currency = pick(raw, FIELDS.currency)?.value ?? DEFAULT_CURRENCY

  // Prefer a price on the product itself; fall back to its variants. Note that
  // FIELDS.price deliberately has no `basePrice` alias — on several APIs that is
  // the wholesale cost, and quoting it in an ad would publish the margin.
  const variant = cheapestVariant(raw)
  const priceSource = pick(raw, FIELDS.price) ? raw : (variant ?? raw)

  const price = readMoney(pick(priceSource, FIELDS.price)?.value, currency)
  const salePrice = readMoney(pick(priceSource, FIELDS.salePrice)?.value, currency)

  const name = stripHtml(String(pick(raw, FIELDS.name)?.value ?? '')) || `Product ${index + 1}`
  const categories = readCategories(raw)

  const stockRaw = readStock(raw) ?? (variant ? readStock(variant) : undefined)
  const outOfStock =
    stockRaw === false ||
    stockRaw === 0 ||
    /out.?of.?stock|unavailable|sold.?out/i.test(String(stockRaw ?? ''))

  // Same reason as WooCommerce: the whole catalogue is persisted to
  // localStorage (~5 MB), and promptBuilder only ever sends the first 400
  // chars. Storing full descriptions is how you blow the quota.
  const description = clip(stripHtml(String(pick(raw, FIELDS.description)?.value ?? '')), 600)
  const shortDescription = clip(
    stripHtml(String(pick(raw, FIELDS.shortDescription)?.value ?? '')),
    400,
  )

  return {
    id: String(pick(raw, FIELDS.id)?.value ?? `custom-${index}`),
    name,
    sku: String(pick(raw, FIELDS.sku)?.value ?? '—'),
    // salePrice only counts when it is genuinely lower — plenty of APIs set it
    // equal to price when nothing is discounted.
    price: price ?? '—',
    salePrice: salePrice && salePrice !== price ? salePrice : null,
    currency,
    emoji: '📦',
    // Gallery, then single image, then the variant's own — catalogues routinely
    // leave the product-level gallery empty and hang the photo off the variant.
    image: readImage(
      pick(raw, FIELDS.images)?.value ??
        pick(raw, FIELDS.image)?.value ??
        (variant && (pick(variant, FIELDS.images)?.value ?? pick(variant, FIELDS.image)?.value)),
    ),
    categories,
    attributes: readList(raw.attributes ?? raw.specs ?? raw.specifications),
    shortDescription,
    description,
    stockStatus: outOfStock ? 'outofstock' : 'instock',
  }
}

/** One page, using an already-detected shape. */
export async function fetchPage({ shape, apiKey, page, perPage, signal }) {
  const scheme = AUTH_SCHEMES.find((s) => s.id === shape.authScheme) ?? AUTH_SCHEMES[0]

  // Send both naming conventions; an API ignores the one it doesn't know.
  const params = {
    page: String(page),
    limit: String(perPage),
    per_page: String(perPage),
    offset: String((page - 1) * perPage),
    ...(scheme.query && apiKey ? scheme.query(apiKey) : {}),
  }

  const res = await fetch(buildUrl(shape.origin, shape.path, params), {
    signal,
    headers: {
      'x-store-target': shape.origin,
      ...(apiKey ? scheme.headers(apiKey) : {}),
    },
  })

  const body = await res.json().catch(() => null)

  if (!res.ok)
    throw new AppError(
      res.status === 401 || res.status === 403 ? 'AUTH_FAILED' : 'NETWORK',
      body?.message ?? `The API returned HTTP ${res.status}.`,
      { status: res.status },
    )

  const found = findProductArray(body)
  return {
    products: (found?.array ?? []).map(normaliseCustomProduct),
    total: findTotal(body),
  }
}
