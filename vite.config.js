import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * Dev proxies exist for one reason: the browser will not let us call a
 * WooCommerce store or the Anthropic API directly from localhost without CORS
 * blowing up. Everything here is DEV ONLY — in production you either run
 * Mode A (own machine) or Mode B (Cloudflare Worker, Appendix H).
 *
 * The store proxy is a hand-written middleware rather than a `server.proxy`
 * entry, because the target has to be chosen **per request** from the URL the
 * user typed in Settings.
 *
 * Why not `server.proxy` with a `router`: Vite's proxy is `http-proxy`, whose
 * options have no `router` field — that belongs to `http-proxy-middleware`, a
 * different package. Vite accepts the key, ignores it, and sends every request
 * to the static `target`. It fails silently, which is exactly how a sentinel
 * target produced `ECONNREFUSED 127.0.0.1:1` instead of anything informative.
 */

/** Only ever proxy somewhere that looks like a real store. Dev-only, but an
 *  unvalidated forwarder is an open relay on your localhost. */
function resolveStoreTarget(header) {
  if (!header || Array.isArray(header)) return null

  let url
  try {
    url = new URL(header)
  } catch {
    return null
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) return null
  if (!url.hostname || (!url.hostname.includes('.') && !isLocal)) return null

  return url.origin
}

/**
 * Forwards `/<mountPath>/*` to `<x-store-target><apiBase>/*`.
 *
 * Errors come back as JSON with a `message` the UI can show, rather than as a
 * Node stack trace in the terminal and an opaque 500 in the browser — the whole
 * point of owning this instead of delegating it.
 */
function storeProxy(mountPath, apiBase = '') {
  return {
    name: `store-proxy${mountPath}`,
    configureServer(server) {
      server.middlewares.use(mountPath, async (req, res) => {
        const send = (status, body) => {
          res.statusCode = status
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(body))
        }

        const target = resolveStoreTarget(req.headers['x-store-target'])
        if (!target) {
          return send(400, {
            message:
              'No valid store URL was sent. Enter your store address in Settings — it must be a full https:// URL.',
          })
        }

        // connect strips the mount path, so req.url is already "/products?…".
        const upstream = `${target}${apiBase}${req.url}`

        try {
          const upstreamRes = await fetch(upstream, {
            headers: {
              accept: 'application/json',
              // Some managed hosts reject requests with no User-Agent outright.
              'user-agent': 'ai-content-studio/0.1 (+dev proxy)',
              // Forward credentials for APIs that need them. A private API is
              // the normal case outside WooCommerce's public Store API.
              ...(req.headers.authorization && { authorization: req.headers.authorization }),
              ...(req.headers['x-api-key'] && { 'x-api-key': req.headers['x-api-key'] }),
            },
            redirect: 'follow',
            signal: AbortSignal.timeout(30_000),
          })

          res.statusCode = upstreamRes.status
          res.setHeader(
            'content-type',
            upstreamRes.headers.get('content-type') ?? 'application/json',
          )
          // Pagination lives in headers; without these the sync loop can't tell
          // how many pages there are.
          for (const header of ['x-wp-total', 'x-wp-totalpages']) {
            const value = upstreamRes.headers.get(header)
            if (value) res.setHeader(header, value)
          }

          res.end(Buffer.from(await upstreamRes.arrayBuffer()))
        } catch (err) {
          const host = target.replace(/^https?:\/\//, '')
          const reason =
            err?.name === 'TimeoutError'
              ? `${host} did not respond within 30 seconds.`
              : /ENOTFOUND|EAI_AGAIN/.test(err?.cause?.code ?? err?.message ?? '')
                ? `Could not find ${host}. Check the domain is spelled correctly.`
                : /ECONNREFUSED|ECONNRESET|CERT|TLS/i.test(
                      err?.cause?.code ?? err?.message ?? '',
                    )
                  ? `${host} refused the connection. Check the site is online and its certificate is valid.`
                  : `Could not reach ${host}. ${err?.message ?? 'Unknown error.'}`

          console.error(`[store-proxy] ${upstream} → ${reason}`)
          send(502, { message: reason })
        }
      })
    },
  }
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // WooCommerce Store API — public, needs no consumer key or secret.
    storeProxy('/wc-store', '/wp-json/wc/store/v1'),
    // Authenticated WooCommerce REST.
    storeProxy('/wc-api', '/wp-json/wc/v3'),
    // Generic passthrough for any other products API: the client supplies the
    // full path, the proxy just forwards it (with credentials) to the host in
    // x-store-target. This is what lets the app talk to a custom backend
    // without a new proxy route per integration.
    storeProxy('/upstream'),
  ],

  server: {
    port: 5173,
    proxy: {
      // Anthropic is a fixed target, so the declarative proxy is fine here.
      '/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/anthropic/, ''),
      },
    },
  },

  build: {
    // docx + jspdf are heavy and only needed on export. Keeping them in their
    // own chunk stops them landing in the initial bundle.
    rollupOptions: {
      output: {
        manualChunks: { export: ['docx', 'jspdf'] },
      },
    },
  },
})
