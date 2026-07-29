# AI Product Content Studio

Turns WooCommerce products into short-form video scripts in **Bengali, English or
Banglish** — with scene breakdowns, shot lists, subtitles, voice preview and a
creative review that flags claims your product data doesn't support.

Runs entirely in the browser. No backend, no accounts, no database.

---

## 1. Quick start

```bash
npm install
npm run dev          # http://localhost:5173
```

It works immediately — six bundled demo products stand in for a store, and every
screen says so. To generate anything you need one AI key (§2); to use your own
products you sync your store (§3) — **no API key required for that**.

```bash
npm run build        # production build into dist/
npm run preview      # serve the build locally
```

**Note:** `npm run preview` and `dist/` have **no dev proxy**, so *syncing* fails
there with CORS. Products you already synced still work — they live in
`localStorage`, not fetched at runtime.

---

## 2. Add an AI provider key

**Settings → API keys.** One of these is enough:

| Provider | Get a key | Notes |
|---|---|---|
| **Claude** | [console.anthropic.com](https://platform.claude.com/settings/keys) | Primary. Best Bengali quality of the three. |
| Gemini | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) | Fallback. |
| Groq | [console.groq.com/keys](https://console.groq.com/keys) | Fast fallback. |

Press **Test** after pasting — it makes a one-token round trip and tells you
whether the key is actually accepted, which is much better than finding out
mid-generation.

With **automatic fallback** on (Settings → AI behaviour), a provider that errors
or rate-limits hands off to the next configured one. A *rejected key* never falls
back — that is a setup problem you should see, not something to paper over.

### ⚠️ Where your keys live — read this

Keys are stored **unencrypted in this browser's `localStorage`**. Any script
running on this origin can read them.

That is a deliberate tradeoff for **Mode A** — running this on your own machine,
which is what the dev server is for. It is the **wrong** model for anything
shared or public. If you deploy this where other people can reach it:

1. Leave the key fields empty.
2. Put the keys behind the Cloudflare Worker proxy in **Appendix H** of the plan.
3. Add rate limiting to that worker. An open `/api/generate` endpoint with your
   key behind it is someone else's free AI service the moment it is discovered.

Backups exported from Settings **exclude API keys** on purpose — a backup file is
the thing people email themselves, and it must not be a credential leak.

---

## 3. Sync your products — no API key needed

This reads your catalogue through **WooCommerce's public Store API**
(`/wp-json/wc/store/v1/products`), the endpoint built for headless storefronts.
**No consumer key, no secret, nothing to create in wp-admin.**

### 3.1 Enter your store URL and sync

**Settings → API keys → Your store.** Type your domain, press **Test
connection**, then **Sync products**. That's the whole setup.

**No `.env` file, no server restart.** A browser can't call your store directly
(CORS), so the dev server proxies `/wc-store/*` — but it routes *dynamically*
from an `x-store-target` header the app sends, taken straight from the field you
just typed in. Change stores and it takes effect on the next click.

This is a deliberate change from an earlier design that read the target from
`VITE_WC_URL` at boot. That version meant the URL lived in two places, only one
of them actually routed, and editing it needed a restart — which produced
exactly one confusing failure mode: `ENOTFOUND your-store.com`, because the
placeholder was still sitting in `.env.local`. The app now refuses obvious
placeholder domains before any request leaves the browser.

### 3.2 What "sync" does

The catalogue imports page by page with a live count, then lives in
`localStorage`. After that, product search in the Studio is **instant and works
offline** — nothing hits your store while you're writing.

The catalogue is a **snapshot**. Re-sync after you change prices or add
products. There's no background polling and nothing expires.

### 3.3 What the Store API does and doesn't give you

| | Store API (used) | Authenticated `/wc/v3` |
|---|---|---|
| Credentials | **none** | `ck_` + `cs_` pair |
| Name, price, sale price, images, description, categories, attributes | ✅ | ✅ |
| Stock status | ✅ | ✅ |
| SKU | partial | ✅ always |
| Draft / private products | ❌ | ✅ |

For writing ad copy the Store API has everything that matters. If you later want
SKUs or drafts, the `/wc-api` proxy route is still wired up in
[vite.config.js](vite.config.js) — you'd add the credential fields back and swap
the fetch in `productService`.

### 3.4 If it doesn't work

| Symptom | Cause |
|---|---|
| *"…is the example placeholder, not a real store"* | The URL field still says `your-store.com`. Put your own domain in. |
| *"Could not reach `<host>`"* | Domain misspelled, or the site is offline. Nothing resolved. |
| *"…has no Store API at /wp-json/wc/store/v1"* | Not WooCommerce, or WooCommerce older than 6.0 |
| *"…refused the request"* | A security plugin or firewall is blocking `/wp-json`. The Store API is normally public. |
| *"The store URL must start with https://"* | Exactly that. |
| Prices look 100× too big | A Store API quirk — it returns **minor units** (`"125000"` = 1250.00). Handled in `formatMoney`; if you fork that code, don't read `prices.price` raw |
| *"…too large for browser storage and will be lost on reload"* | Your catalogue exceeds the ~5 MB localStorage limit. Export and clear old scripts in Settings → Data, then re-sync |

**Verified against a live store:** 1,547 products from `woocommerce.com` sync in
~90 seconds and persist at 3.74 MB. Product descriptions are truncated to 600
characters on import — `promptBuilder` only ever sends the first 400 to the
model, and keeping the full HTML pushed the same catalogue to 23 MB, well past
what the browser will store.

---

## 4. How a script gets made

1. **Pick up to five products** from your synced catalogue. The cap is enforced
   in the store, not the UI — past five, a script can't give any single product
   enough time to land.
2. **Set the brief.** Type, tone, language, duration, audience, brand, and free-text
   direction. The word budget shown (`≈126 words`) is duration × a
   per-language words-per-second rate, and it is what actually keeps scene
   durations summing to the target.
3. **Generate.** Structured outputs enforce the JSON shape; `normaliseScript`
   then *rescales* scene durations so they sum exactly to the requested length —
   models routinely miss this by 10–20% even when told not to.
4. **Edit in place.** Click any block's pencil. Ctrl+Enter saves, Escape
   discards, Undo is in the action bar.
5. **Regenerate one scene** rather than the whole script — far cheaper, and it
   keeps everything you already liked.
6. **Save** to move it from the working draft into the Library.

The **Tools** tab runs a creative review that returns verdicts and reasons rather
than a score out of 100 — a number invites you to optimise it; a verdict plus a
reason tells you what to change. The field to actually act on is
`unsupported_claims`: it catches the model inventing a warranty or a battery life
that isn't in your product data, before it becomes an ad you have to answer for.

---

## 5. Exporting, and the Bengali problem

| Format | Bengali | Notes |
|---|---|---|
| **Copy to clipboard** | ✅ | Never breaks. |
| **TXT** | ✅ | UTF-8 with BOM so Windows Notepad renders it. |
| **DOCX** | ✅ | **The recommended Bengali route.** |
| SRT / VTT | ✅ | Timings computed in JS, not by the model. |
| JSON | ✅ | Full record, for re-import or scripting. |
| **PDF** | ❌ **English only** | See below. |

**In-app PDF export is disabled for Bengali on purpose.** jsPDF has no Bengali
coverage in its built-in fonts, and even with a TTF embedded its text shaping
does not do complex-script conjunct reordering — Bengali যুক্তাক্ষর render
incorrectly. Rather than ship subtly broken PDFs, the option is disabled with an
explanation.

**To get a Bengali PDF: export DOCX, open in Word, save as PDF.** Word shapes the
script correctly.

DOCX declares `Nirmala UI` (ships with Windows 8+) on every run that carries
Bengali text. The `docx` library references fonts by name rather than embedding
them, so without that declaration Word substitutes and you get tofu boxes.

---

## 6. Voice

**Browser TTS is the default and needs no key.** It is genuinely useful for the
thing people actually want here — hearing whether a hook lands when spoken aloud.

It **cannot export a file**: the Web Speech API gives you playback, not a buffer.
For downloadable MP3s add an ElevenLabs or Google TTS key. The UI states this
rather than offering a download that fails.

Bengali browser voices are rare; the app falls back to any available voice rather
than staying silent.

---

## 7. Your data

Everything lives in this browser's `localStorage`. There is no server and no
sync — including the "Team Workspace" board, whose comments and assignees are
local to you. The UI says so rather than implying otherwise.

**This means clearing browsing data deletes your work.**

Settings → Data & debug → **Export backup** writes a JSON file with every script,
brand and calendar entry (but no keys). Restore from the same screen. Do this
before clearing anything.

**Debug mode** logs every AI request and response — prompt, provider, tokens,
milliseconds, raw text — into a rolling in-memory buffer with a "Copy debug log"
button. It is never written to storage. When a generation comes back wrong, the
first question is always "what did we actually send", and this answers it.

---

## 8. Known limitations

- **Storage is browser-local.** No sync, no multi-device, no real collaboration.
  Clearing site data loses everything not exported.
- **Bengali PDF is unsupported** (§5). DOCX → Word is the route.
- **Keys are readable by any script on the origin** (§2). Mode A only.
- **~5 MB localStorage ceiling.** Settings shows current usage. Roughly a few
  hundred scripts; the Library warns before it becomes a problem.
- **The Studio needs ~1120px** to show its three columns without horizontal
  scrolling. Everything else works down to 375px.
- **Cost tracking is configured for Claude models only.** Gemini and Groq rates
  are deliberately `null` in `src/config/pricing.js` rather than guessed — the UI
  shows "not configured" instead of a confidently wrong `$0.00`. Fill them in
  from each provider's pricing page.
- **One remaining npm advisory**: a React Router RSC-mode CSRF issue affecting
  7.12.0–8.2.0. This app is a client-only SPA using `BrowserRouter` and never
  enters RSC mode. 7.18.1 is the latest release and fixes the three advisories
  that *do* apply (XSS via open redirects, ScrollRestoration XSS, turbo-stream
  RCE); no 8.x exists yet.

---

## 9. Project layout

```
src/
├── config/        models, pricing, constants, demo products
├── pages/         one file per route
├── components/
│   ├── ui/        the primitives — build to these, don't reinvent
│   ├── layout/    Sidebar, Navbar, AppLayout
│   ├── product/   search, card, skeleton
│   ├── script/    config, output, scene, blocks, voice, tools
│   ├── settings/  key card, setup status, danger zone
│   └── shared/    ExportMenu
├── store/         zustand, persisted where it matters
├── services/      productService, aiService, voiceService
├── utils/         errors, text, parsing, prompts, exports, storage
└── hooks/         useMediaQuery
```

Two files deviate from the canonical tree in Appendix A, both deliberately:

- **`config/demoProducts.js`** — without it, every screen past product selection
  is unreachable until someone has WooCommerce credentials, so the app can't be
  demoed or handed over. The data is in the same `NormalisedProduct` shape the
  service emits, and the UI always says when it is in use.
- **`hooks/useMediaQuery.js`** — needed to force the sidebar collapsed below
  900px, which is what makes the 375px checklist item pass.

**Design system:** `src/index.css` + **Appendix K** of the plan. Read K before
changing colours, type or spacing.

**Component contracts:** Appendix C. Props are fixed there; a component that
invents its own prop shape breaks the next session's work.

---

## 10. Before you call it done

Run through the pre-ship checklist in **Appendix J**. Current state:

- [x] `npm run build` succeeds; `npm run preview` works
- [x] No `console.log` outside the DEBUG flag (errors are logged with context, per Appendix E)
- [x] No API key in any URL query string
- [x] Backup export → clear all → import → everything restored
- [x] Tested at 375px width
- [x] Light and dark themes both render; custom accent re-themes coherently
- [x] Bengali renders in-app, in the editor, and in DOCX export
- [ ] Tested in a second (non-Chromium) browser
- [ ] Full keyboard-only pass over every control
- [ ] End-to-end generation against a live provider key
