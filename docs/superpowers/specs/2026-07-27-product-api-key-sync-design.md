# Product catalogue sync via a shared API key

**Date:** 2026-07-27
**Status:** Approved for planning
**Repos:** `DS_Atomation/backend` (most of the work), `AI Product Content Studio` (one fix)

## Goal

Hand someone a single API key. They paste it into AI Product Content Studio along
with a URL, press Sync, and that business's products appear in the Studio
catalogue. No JWT, no login, no expiry.

## Why this is needed

Today it is impossible. `/api/v1/products` is mounted behind
`authMiddleware, tenantContext, requirePermission('products')` (`app.js:1512-1518`),
and `authMiddleware` accepts only `Authorization: Bearer <jwt>` verified against
`JWT_SECRET` (`middleware/auth.js:4-11`). There is no `/public` route on that
router, so `GET /api/v1/products/public` returns 401 before routing.

The only key-authenticated product endpoint is `POST /api/products/sync`
(`app.js:1563`), which reads `req.body.apiKey` (`productSyncRoute.js:17`) and
pushes products *into* DS_Automation. It is the wrong direction and the wrong
transport.

No inbound `x-api-key` handling exists anywhere in the backend. The two hits in
`productAutoSync.js:1068-1072` and `productService.js:1101-1105` are outbound,
where DS_Automation is the client.

## Non-goals

- **Rate limiting.** No rate-limiting middleware exists anywhere in this backend.
  Adding a dependency for one endpoint is scope creep. Mitigation: keys are
  per-tenant and revocable in one command.
- **Admin UI for keys.** CLI only. A UI can be added later against the same table
  without rework.
- **Fixing `GET /api/products/sync/status/:batchId`**, which is JWT-exempt via
  `protectExceptPublic(['/sync'])`'s prefix match and then checks no key at all
  (`productSyncRoute.js:135`). Real gap, separate decision.
- Write access of any kind. This endpoint is read-only.

## Architecture

Four new units, each independently testable:

```
scripts/create-product-key.js   → mints/lists/revokes keys
migrations/20260727_*.sql       → product_api_keys table
middleware/productApiKeyAuth.js → X-API-Key → req.tenantId
api/routes/productPublic.js     → GET / → paginated JSON
services/productService.js      → listPublicProducts(tenantId, {limit, offset})
```

### 1. `product_api_keys` table

`backend/migrations/20260727_product_api_keys.sql`, following the existing
`YYYYMMDD_name.sql` convention:

```sql
CREATE TABLE IF NOT EXISTS product_api_keys (
  id           SERIAL PRIMARY KEY,
  tenant_id    INTEGER NOT NULL,
  key_hash     TEXT NOT NULL UNIQUE,
  key_prefix   VARCHAR(16) NOT NULL,
  label        VARCHAR(120),
  last_used_at TIMESTAMP,
  revoked_at   TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_api_keys_lookup
  ON product_api_keys (key_hash) WHERE revoked_at IS NULL;
```

Only the SHA-256 hash is stored, so a database dump yields no working keys.
`key_prefix` (first 12 chars) exists so a human can identify a key in `--list`
output without it being usable.

Key format: `dsp_` + 32 random bytes as hex (`crypto.randomBytes(32)`).

### 2. `middleware/productApiKeyAuth.js`

Reads the `X-API-Key` header, hashes it, looks up a non-revoked row, sets
`req.tenantId`, and updates `last_used_at` fire-and-forget.

**`X-API-Key` only — Bearer is deliberately not accepted**, to keep it
unambiguous against JWT auth. This costs nothing: the Studio's `detectApi`
probes `bearer` first, gets 401, and automatically falls through to `x-api-key`
on the next attempt (`customApiService.js:31-38, 152-156`).

Failure responses carry **both** `error` and `message`. The Studio surfaces
`body?.message` (`customApiService.js:350`), so `error` alone would show the
user a bare "The API returned HTTP 401."

| Condition | Status | Body |
|---|---|---|
| No header | 401 | `{ error, message: "An API key is required. Send it in the X-API-Key header.", code: "NO_API_KEY" }` |
| Unknown or revoked | 401 | `{ error, message: "That API key is not valid, or has been revoked.", code: "BAD_API_KEY" }` |
| DB failure | 500 | `{ error, message: "Could not verify the API key." }` |

### 3. `api/routes/productPublic.js`

A new file rather than another route in `productSyncRoute.js`, which is already
~780 lines and mixes public sync with admin CRUD for offers, shops and
businesses.

Mounted in `app.js` **before** the `/api/products` mount so the more specific
path wins, and with no JWT middleware at all:

```js
app.use('/api/products/public', require('./api/routes/productPublic'));
```

This avoids touching `protectExceptPublic(['/sync'])` and its prefix-matching
behaviour entirely.

**`GET /api/products/public`**

| Param | Default | Notes |
|---|---|---|
| `page` | 1 | 1-based |
| `limit` | 100 | clamped to 200; over-limit clamps silently, does not error |

The Studio sends `page`, `limit`, `per_page` and `offset` together
(`customApiService.js:329-335`). We honour `page` and `limit`; the others are
ignored and agree with them anyway.

Response:

```json
{
  "data": [
    {
      "id": "42",
      "name": "Vitamin C Serum",
      "sku": "VCS-30",
      "price": "1250.00",
      "salePrice": "999.00",
      "currency": "BDT",
      "shortDescription": "Brightening serum for daily use.",
      "description": "...",
      "image": "https://.../cover.jpg",
      "images": ["https://.../1.jpg"],
      "categories": ["Skincare", "Serums"],
      "stockStatus": "instock"
    }
  ],
  "total": 517,
  "page": 1,
  "limit": 100
}
```

Every name here is the **first** alias in the Studio's `FIELDS` table
(`customApiService.js:41-54`); `data` is the first key `findProductArray` checks
(line 74) and `total` the first `findTotal` checks (line 91). Auto-detection has
nothing left to guess.

### 4. `productService.listPublicProducts(tenantId, { limit, offset })`

Reuses the existing tenant visibility rule from `listProducts`
(`productService.js:997`) so shared products behave identically:

```sql
SELECT p.id, p.name, p.sku, p.price, p.display_price, p.discount_percentage,
       p.clean_description, p.description, p.seo_description,
       p.cover_image, p.images, p.stock, p.stock_status,
       COALESCE(p.category, c.name)   AS category,
       COALESCE(p.sub_category, sc.name) AS sub_category,
       COUNT(*) OVER() AS total_count
FROM products p
LEFT JOIN product_categories c  ON p.category_id     = c.id
LEFT JOIN product_categories sc ON p.sub_category_id = sc.id
WHERE (p.tenant_id = $1
       OR p.id IN (SELECT product_id FROM product_tenants WHERE tenant_id = $1))
  AND p.is_deleted = false
  AND COALESCE(p.status, 'active') = 'active'
ORDER BY p.created_at DESC
LIMIT $2 OFFSET $3
```

`status` is `'active'` / `'inactive'` — Joi validates `ACTIVE|INACTIVE`
(`productService.js:13`), it is lowercased on ingest (line 125) and defaults to
`'active'` (line 766). Deactivated products are excluded: there is no reason to
generate ad copy for one.

An explicit column whitelist, not `SELECT *` / `p.*`. `tenant_id`, `external_id`,
`source` and `brand_id` must not leave the building — the key lives in a browser
and anything returned is visible in devtools.

`COUNT(*) OVER()` supplies `total` without a second query.

**Field derivation:**

| Output | From |
|---|---|
| `price` | `price` — the **undiscounted** headline price |
| `salePrice` | `discount_percentage > 0 ? round(price × (1 − d/100), 2) : null` |
| `description` | `clean_description` ?? `description` |
| `shortDescription` | `seo_description` ?? first 200 chars of description |
| `image` | `cover_image` ?? `images[0]` |
| `categories` | `[category, sub_category]` minus nulls |
| `stockStatus` | `stock_status === 'out_of_stock'` → `outofstock`, else `instock` |
| `currency` | `"BDT"` constant |

The `price`/`salePrice` split matters: the Studio treats `price` as the original
and `salePrice` as the discounted one (`productService.js:112-115`, Studio repo),
so the prompt builder can say "X (was Y) — ON SALE". Deriving `salePrice` from
`discount_percentage` server-side is the whole reason for a purpose-built shape;
the Studio's `FIELDS` has no alias for `discount_percentage` and would silently
quote undiscounted prices in every generated ad.

`stock_status` is stored underscored (`'in_stock'` / `'out_of_stock'`,
`productService.js:933`) and normalised on the way out.

### 5. `scripts/create-product-key.js`

```
npm run product-key -- --create --tenant 3 --label "Content Studio"
npm run product-key -- --list
npm run product-key -- --revoke dsp_a1b2c3d4
```

`--create` prints the raw key **once** and never again. `--revoke` matches on
`key_prefix`.

### 6. Studio-side fix

`src/components/settings/StoreSync.jsx:100` compares a bare origin against the
full URL in the input, so the "products came from X, but the URL has changed"
warning can never clear:

```js
const originOf = (u) => { try { return new URL(u).origin } catch { return null } }
const staleUrl = syncedFrom && storeUrl && syncedFrom !== originOf(storeUrl)
```

### 7. Stale comment

`app.js:1474` claims `/sync` authenticates via X-API-Key. It reads
`req.body.apiKey`. Correct the comment — it is what produced the incorrect
understanding that sent us down the `/api/v1/products/public` path.

## Setup the user performs

1. `npm run product-key -- --create --tenant <id> --label "Content Studio"`
2. In Studio Settings:
   - **Store or API URL** → `https://api.dsit.app/api/products/public`
   - **API key** → the `dsp_…` key
3. Sync.

In dev the Studio's proxy already forwards `x-api-key` (`vite.config.js:79`), so
no client proxy work is needed. In production the proxy does not exist
(`configureServer` is dev-only) and the browser calls `api.dsit.app` directly —
`CORS_ORIGIN` must then include the Studio's origin (`app.js:30-37`).

## Security posture

The Studio is Mode A — its README (line 227) already states keys are readable by
any script on the origin. So this key is **not a secret** in the way a JWT signing
key is. That is acceptable because the key is read-only, scoped to one tenant,
independently revocable, and exposes only catalogue data the business publishes
anyway. It is not acceptable to widen the endpoint beyond the whitelist above.

## Testing

Jest is already configured (`jest.config.js`).

- **Tenant isolation** — a key for tenant A never returns a product belonging
  only to tenant B. This is the test that matters most; write it first.
- Shared products (via `product_tenants`) are visible to a granted tenant's key.
- Missing / unknown / revoked key each return 401 with a `message` field.
- `limit=5000` clamps to 200 rather than erroring.
- `salePrice` is null at `discount_percentage = 0`, and correct at 25.
- A product with `status = 'inactive'` is excluded; one with `status` NULL is included.
- Response contains no `tenant_id`, `external_id`, `source` or `brand_id`.
- `total` reflects the full matching set, not the page length.
- Studio-side: `staleUrl` is false when the input URL is the synced origin plus a
  path.
