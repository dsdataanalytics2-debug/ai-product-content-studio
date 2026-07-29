# 📎 AI Product Content Studio 

> **Companion to BUILD-PLAN v2.0.** The main plan says *what* to build and in what order. This file defines the shared contracts that every step depends on — the things that, if left undefined, cause each AI session to invent its own version and break the previous session's work.
>
> **Paste the relevant appendix alongside the step you're building.** Never paste this whole file.

**Contents**
- A — Canonical file tree
- B — UI primitives (build these before any feature)
- C — Component contracts (props tables)
- D — Complete prompt library
- E — Error taxonomy + `AppError`
- F — Bengali export: DOCX and PDF font embedding
- G — `config/pricing.js` and cost estimation
- H — Mode B: Cloudflare Worker proxy
- I — Debugging playbook: known failure modes
- J — Conventions, git hygiene, pre-ship checklist
- K — Frontend design system ("Nocturne")

---

## APPENDIX A — Canonical File Tree

v2.0 changed the structure but never printed it. This is the authoritative tree. Every session should be told to conform to it.

```
ai-content-studio/
├── public/
├── src/
│   ├── config/
│   │   ├── models.js            # model IDs + endpoints        (Step 2)
│   │   ├── pricing.js           # token rates                  (Step 2, App. G)
│   │   └── constants.js         # option lists, limits, enums  (Step 2)
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── ScriptStudio.jsx
│   │   ├── ScriptLibrary.jsx
│   │   ├── BrandMemory.jsx      # Phase 2 — placeholder in MVP
│   │   └── Settings.jsx
│   ├── components/
│   │   ├── ui/                  # ← APPENDIX B. Build first.
│   │   │   ├── Button.jsx
│   │   │   ├── Card.jsx
│   │   │   ├── Input.jsx
│   │   │   ├── OptionCard.jsx
│   │   │   ├── Badge.jsx
│   │   │   ├── Skeleton.jsx
│   │   │   ├── EmptyState.jsx
│   │   │   ├── Modal.jsx
│   │   │   └── ErrorBoundary.jsx
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Navbar.jsx
│   │   │   └── AppLayout.jsx
│   │   ├── product/
│   │   │   ├── ProductSearch.jsx
│   │   │   ├── ProductCard.jsx
│   │   │   └── ProductGridSkeleton.jsx
│   │   ├── script/
│   │   │   ├── ScriptConfig.jsx
│   │   │   ├── ScriptOutput.jsx
│   │   │   ├── SceneCard.jsx
│   │   │   ├── ScriptBlock.jsx
│   │   │   └── GenerationStatus.jsx
│   │   ├── settings/
│   │   │   ├── ApiKeyCard.jsx
│   │   │   ├── SetupStatus.jsx
│   │   │   └── DangerZone.jsx
│   │   └── shared/
│   │       └── ExportMenu.jsx
│   ├── store/
│   │   ├── useApiStore.js
│   │   ├── useSettingsStore.js
│   │   ├── useScriptStore.js
│   │   ├── useLibraryStore.js
│   │   └── useBrandStore.js     # Phase 2
│   ├── services/
│   │   ├── productService.js
│   │   ├── aiService.js
│   │   └── voiceService.js      # Phase 2
│   ├── utils/
│   │   ├── promptBuilder.js
│   │   ├── parseAiJson.js
│   │   ├── exportUtils.js
│   │   ├── errors.js            # APPENDIX E
│   │   ├── storage.js           # safeSetItem, backup/restore
│   │   └── text.js              # stripHtml, wordCount, truncate
│   ├── assets/fonts/
│   │   └── NotoSansBengali-Regular.ttf   # APPENDIX F
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── vite.config.js
└── README.md                    # write this — APPENDIX J
```

**Rule:** if a session wants to create a file not in this tree, it must say why first.

---

## APPENDIX B — UI Primitives

**Build these before any feature.** Without them, session 3 writes a purple button with `px-4 py-2 rounded-lg`, session 7 writes one with `px-5 py-2.5 rounded-xl`, and the app looks assembled from parts. Ten small files that prevent a hundred inconsistencies.

### `Button.jsx`
```jsx
const VARIANTS = {
  primary:   'bg-[var(--accent)] hover:bg-violet-700 text-white',
  secondary: 'border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text)]',
  ghost:     'hover:bg-[var(--bg-hover)] text-[var(--text-dim)] hover:text-[var(--text)]',
  danger:    'bg-[var(--danger)] hover:bg-red-600 text-white',
}
const SIZES = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2 text-sm', lg: 'px-6 py-3 text-base' }

export default function Button({
  variant = 'primary', size = 'md', loading = false, disabled = false,
  icon: Icon, children, ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium
        transition-colors disabled:opacity-50 disabled:cursor-not-allowed
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500
        focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg-primary)]
        ${VARIANTS[variant]} ${SIZES[size]}`}
      {...props}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : Icon && <Icon className="w-4 h-4" />}
      {children}
    </button>
  )
}
```

**Required props for the rest — build to these signatures exactly:**

| Component | Props |
|---|---|
| `Card` | `{ title?, actions?, padded = true, className?, children }` |
| `Input` | `{ label, value, onChange, type = 'text', error?, hint?, placeholder?, masked?, dir? }` — `masked` adds the eye toggle; `dir` for Bengali RTL-safety (Bengali is LTR, but set `lang="bn"` for correct font/shaping) |
| `OptionCard` | `{ icon, label, sublabel?, selected, onClick, disabled?, disabledReason? }` — the clickable card used throughout ScriptConfig |
| `Badge` | `{ children, tone = 'neutral' }` — tone: `neutral \| success \| warning \| danger \| accent` |
| `Skeleton` | `{ className }` — just `animate-pulse bg-[var(--bg-hover)] rounded` |
| `EmptyState` | `{ icon, title, description, action? }` — **every list must use this**, never render a bare "no results" |
| `Modal` | `{ open, onClose, title, children, footer? }` — must close on Escape and on backdrop click, and trap focus |
| `ErrorBoundary` | class component, wraps each route, shows the error + a Reload button + Copy error details |

**Motion guard — put in `index.css`:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

---

## APPENDIX C — Component Contracts

The single biggest cause of breakage across sessions is session N inventing a prop shape that session N+1 doesn't match. Fix the interfaces here.

| Component | Props in | Emits / writes to |
|---|---|---|
| `ProductSearch` | `{ onContinue }` | reads/writes `useScriptStore.selectedProducts` |
| `ProductCard` | `{ product: NormalisedProduct, selected: boolean, onToggle(id), disabled: boolean }` | nothing — pure |
| `ScriptConfig` | `{ onGenerate(config) }` | reads `useScriptStore.selectedProducts`, `useBrandStore.brands` |
| `GenerationStatus` | `{ status, provider, elapsedMs, onCancel }` | nothing — pure |
| `ScriptOutput` | `{ record: ScriptRecord }` | writes edits to `useScriptStore.updateField(path, value)` |
| `SceneCard` | `{ scene, index, onEdit(field, value), onRegenerate(index), isRegenerating }` | nothing — pure |
| `ScriptBlock` | `{ label, value, tone, onEdit(value), copyable = true }` | nothing — pure |
| `ExportMenu` | `{ record, formats = ['txt','json','docx'] }` | calls `exportUtils` |
| `ApiKeyCard` | `{ keyName, label, provider, icon, masked = true, onTest(keyName) }` | writes `useApiStore` |
| `SetupStatus` | none | reads `useApiStore.keys` + `testResults` |

**Store action signatures — fix these now:**
```javascript
// useScriptStore
selectedProducts: NormalisedProduct[]
config: ScriptConfig
current: ScriptRecord | null
generation: { status: 'idle'|'generating'|'error', provider: string|null, startedAt: number|null, error: AppError|null }
history: ScriptRecord[]            // last 10, for undo

toggleProduct(product)             // enforces the max-5 cap internally
setConfig(partial)                 // shallow merge
startGeneration(provider)
finishGeneration(record)
failGeneration(appError)
updateField(path, value)           // e.g. updateField('script.scenes.0.voiceover', 'নতুন লেখা')
undo()
clearAll()

// useLibraryStore
records: ScriptRecord[]
save(record)                       // upsert by id, sets updatedAt
remove(id)
duplicate(id)
search({ q, status, language, from, to }) -> ScriptRecord[]
```

`updateField` taking a dot-path is deliberate — it lets every editable block in `ScriptOutput` share one handler instead of each defining bespoke setters.

---

## APPENDIX D — Complete Prompt Library

v2.0 sketched these. Here they are in full. Put each in `promptBuilder.js` as a named export.

### D.1 System prompt (all generations)
```javascript
export const buildSystemPrompt = (config) => `You are an expert short-form video scriptwriter specialising in e-commerce product videos for the Bangladeshi market.

OUTPUT RULES
- Respond with valid JSON only. No markdown code fences, no preamble, no trailing commentary.
- Use double quotes. Escape any internal quotes.

FACTUAL RULES
- Every claim must be traceable to the product data supplied. Never invent specifications, capacities, warranty terms, certifications, awards, or test results.
- If the product data does not state something, do not assert it. Reframe as a benefit or omit it.
- Do not invent testimonials or statistics. If no social proof is available in the data, write a benefit-framed line instead and note it in claims_used.
- Avoid absolute superlatives ("best in Bangladesh", "100% guaranteed") unless the product data states them.

LENGTH RULES
- Target total voiceover length: ${config.wordBudget} words (${config.durationSeconds}s at ${config.wps} words/second).
- Stay within ±10% of the word budget. Scene durations must sum to ${config.durationSeconds}.

LANGUAGE
${LANGUAGE_RULES[config.language]}`

const LANGUAGE_RULES = {
  bn: `- Write all voiceover and on-screen text in natural, colloquial Dhaka Bengali (চলিত ভাষা), the way people actually speak — not literary or formal Bengali (সাধু ভাষা).
- Everyday English loanwords that Bangladeshis genuinely use in speech (যেমন: ডেলিভারি, অর্ডার, ব্যাটারি, চার্জ) are fine in Bengali script.
- Prices in Bengali: "মাত্র ২,৪৫০ টাকা".`,

  en: `- Write in clear, conversational English. Short sentences. Active voice. No corporate jargon.`,

  banglish: `- Write in Banglish: Bengali sentence structure and vocabulary in Latin script, mixed with English words, the way Bangladeshi users write on Facebook.
- Example register: "Ei fan ta 8 ghonta obdi chole, load-shedding e ar tension nai."
- Do not write formal transliteration — write how people actually type.`,
}
```

### D.2 Script generation (user prompt)
```javascript
export const buildScriptPrompt = (products, config, brand) => `
${brand ? `BRAND CONTEXT
Name: ${brand.name}
Tone of voice: ${brand.tone}
Writing style: ${brand.writingStyle}
Never use these words: ${brand.forbiddenWords.join(', ') || '(none)'}
Preferred CTAs: ${brand.preferredCTAs.join(' | ') || '(none)'}
Required disclaimers: ${brand.disclaimers || '(none)'}
` : 'BRAND CONTEXT: none — use a neutral, trustworthy seller voice.\n'}
PRODUCT DATA
${products.map((p, i) => `
[Product ${i + 1}]
Name: ${p.name}
Price: ${p.salePrice ? `${p.salePrice} (was ${p.price}) — ON SALE` : p.price}
SKU: ${p.sku}
Categories: ${p.categories.join(', ')}
Key attributes: ${p.attributes.join(' | ') || '(none listed)'}
Description: ${truncate(p.shortDescription || p.description, 400)}
`).join('')}

VIDEO BRIEF
Type: ${VIDEO_TYPE_BRIEFS[config.videoType]}
Tone: ${config.tone}
Duration: ${config.durationSeconds} seconds (~${config.wordBudget} words)
Target audience: ${config.targetAudience || 'general Bangladeshi online shoppers'}
Delivery: ${config.voiceScope === 'voiceover' ? 'single narrator voiceover' : 'full script with visual direction'}

REQUIRED JSON SHAPE
${JSON.stringify(SCRIPT_SCHEMA, null, 2)}
`

const VIDEO_TYPE_BRIEFS = {
  review:     'Product review — honest assessment, lead with the strongest real benefit, acknowledge one limitation to build trust.',
  unboxing:   'Unboxing — sensory and sequential. What is in the box, first impressions, build quality moments.',
  benefits:   'Benefits-focused — every scene answers "what does this change in the buyer\'s day".',
  comparison: 'Comparison — contrast the products supplied against each other on the dimensions that matter to the buyer. Never name a competitor brand not present in the data.',
  tutorial:   'Tutorial — show the product solving a specific task, step by step.',
}
```

### D.3 Subtitle chunking (text only — timings computed in JS)
```javascript
export const buildSubtitlePrompt = (voiceovers, language) => `Split the following voiceover text into subtitle blocks for burned-in captions.

RULES
- Maximum 42 characters per line, maximum 2 lines per block.
- Split at natural clause boundaries. Never split mid-word or mid-number.
- Preserve the original text exactly — do not rewrite, shorten, or translate.
- Return JSON only: { "blocks": [{ "sceneIndex": 0, "text": "..." }] }

TEXT
${voiceovers.map((v, i) => `[Scene ${i}] ${v}`).join('\n')}`
```
Then time them in JS — deterministic, free, and correct:
```javascript
export function timeSubtitles(blocks, wps) {
  let t = 0
  return blocks.map((b, i) => {
    const dur = Math.max(1.2, wordCount(b.text) / wps)
    const row = { index: i + 1, start: t, end: t + dur, text: b.text }
    t += dur
    return row
  })
}
export const srtTime = (s) => {
  const ms = Math.round((s % 1) * 1000)
  const total = Math.floor(s)
  const hh = String(Math.floor(total / 3600)).padStart(2, '0')
  const mm = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const ss = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}:${ss},${String(ms).padStart(3, '0')}`
}
```

### D.4 Single-scene regeneration (cheap — don't regenerate everything)
```javascript
export const buildSceneRegenPrompt = (script, sceneIndex, instruction) => `Rewrite ONE scene of an existing video script. Keep everything else unchanged.

FULL SCRIPT (for context only — do not rewrite):
${JSON.stringify({ hook: script.hook, cta: script.cta, scenes: script.scenes.map(s => s.title) })}

SCENE TO REWRITE (index ${sceneIndex}):
${JSON.stringify(script.scenes[sceneIndex], null, 2)}

INSTRUCTION: ${instruction || 'Make it stronger and more specific while keeping the same duration and intent.'}

Return JSON only, the single rewritten scene object with the same keys and the same duration_seconds.`
```

### D.5 AI feedback (not a score)
```javascript
export const buildFeedbackPrompt = (script, brand) => `Review this video script as an experienced direct-response creative director.

Return JSON only:
{
  "hook": { "verdict": "strong|adequate|weak", "why": "", "rewrite_suggestion": "" },
  "clarity": { "verdict": "", "why": "" },
  "pacing": { "verdict": "", "why": "" },
  "cta": { "verdict": "", "why": "", "rewrite_suggestion": "" },
  "brand_fit": { "verdict": "", "why": "" },
  "unsupported_claims": ["any claim in the script not backed by the product data"],
  "biggest_strength": "",
  "biggest_weakness": "",
  "three_quick_fixes": ["", "", ""]
}

Be specific and critical. Vague praise is useless. If something is weak, say exactly what and why.

SCRIPT: ${JSON.stringify(script)}
${brand ? `BRAND GUIDELINES: ${JSON.stringify(brand)}` : ''}`
```

> `unsupported_claims` is the field to act on. It catches the model hallucinating a warranty or a battery life that isn't in your product data — before it becomes an ad you have to answer for.

---

## APPENDIX E — Error Taxonomy

One error class, one message map, used everywhere. Prevents each session inventing its own error shape.

`src/utils/errors.js`
```javascript
export class AppError extends Error {
  constructor(code, message, meta = {}) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.meta = meta
    this.status = meta.status ?? null
  }
}

export const ERROR_MESSAGES = {
  NO_KEYS:        { title: 'No AI provider configured', body: 'Add a Claude, Gemini, or Groq key in Settings.', action: { label: 'Open Settings', to: '/settings' } },
  NO_STORE:       { title: 'Store not connected',       body: 'Add your WooCommerce URL, consumer key, and secret in Settings.', action: { label: 'Open Settings', to: '/settings' } },
  AUTH_FAILED:    { title: 'Authentication failed',     body: 'The API key was rejected (401). Check for extra spaces when pasting.' },
  RATE_LIMITED:   { title: 'Rate limited',              body: 'The provider is throttling requests. Wait a minute, or switch provider in Settings.' },
  CORS_BLOCKED:   { title: 'Blocked by CORS',           body: 'Your browser blocked the request to your store. Set up the Vite dev proxy — see README section 3.' },
  NETWORK:        { title: 'Network error',             body: 'Could not reach the server. Check your connection and that the URL includes https://.' },
  PARSE_FAILED:   { title: 'Malformed AI response',     body: 'The model returned text that is not valid JSON. Try regenerating, or switch to a different model.' },
  QUOTA_EXCEEDED: { title: 'Browser storage full',      body: 'Delete old scripts in Library, or export a backup and clear.' },
  ABORTED:        { title: 'Cancelled',                 body: 'Generation was cancelled.' },
  UNKNOWN:        { title: 'Something went wrong',      body: 'An unexpected error occurred.' },
}

export function classifyHttpError(status, body) {
  if (status === 401 || status === 403) return new AppError('AUTH_FAILED', ERROR_MESSAGES.AUTH_FAILED.body, { status })
  if (status === 429)                   return new AppError('RATE_LIMITED', ERROR_MESSAGES.RATE_LIMITED.body, { status })
  if (status === 0)                     return new AppError('CORS_BLOCKED', ERROR_MESSAGES.CORS_BLOCKED.body, { status })
  return new AppError('UNKNOWN', body?.error?.message ?? `HTTP ${status}`, { status })
}
```

**Rule for every catch block:** show `title` in the toast, `body` in the panel, render `action` as a button, and log the raw error to console with the request context. Never surface a raw stack trace to the UI, and never swallow one silently.

---

## APPENDIX F — Bengali Export (the part that will break)

This is the single most likely thing to fail silently and waste your afternoon.

### F.1 DOCX — declare the font on every run
The `docx` library does not embed fonts; it references them by name and Word substitutes. Without a Bengali-capable font name, Word may render tofu boxes on machines that would otherwise be fine.

```javascript
import { Document, Packer, Paragraph, TextRun, HeadingLevel } from 'docx'

const BN_FONT = 'Nirmala UI'          // ships with Windows 8+
const EN_FONT = 'Calibri'

const run = (text, { lang, bold = false, size = 22 } = {}) =>
  new TextRun({ text, bold, size, font: lang === 'bn' ? BN_FONT : EN_FONT })

export async function exportAsDOCX(record) {
  const lang = record.config.language === 'en' ? 'en' : 'bn'
  const doc = new Document({
    styles: { default: { document: { run: { font: lang === 'bn' ? BN_FONT : EN_FONT, size: 22 } } } },
    sections: [{
      properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
      children: [
        new Paragraph({ text: record.title, heading: HeadingLevel.HEADING_1 }),
        new Paragraph({ children: [run('HOOK', { bold: true })] }),
        new Paragraph({ children: [run(record.script.hook, { lang })] }),
        ...record.script.scenes.flatMap((s, i) => [
          new Paragraph({ children: [run(`Scene ${i + 1} — ${s.title} (${s.duration_seconds}s)`, { bold: true })] }),
          new Paragraph({ children: [run(s.voiceover, { lang })] }),
          new Paragraph({ children: [run(`Visual: ${s.visual_direction}`, { size: 18 })] }),
        ]),
        new Paragraph({ children: [run('CTA', { bold: true })] }),
        new Paragraph({ children: [run(record.script.cta, { lang })] }),
      ],
    }],
  })
  const blob = await Packer.toBlob(doc)
  download(blob, `${slug(record.title)}.docx`)
}
```

### F.2 PDF — jsPDF has **zero** Bengali coverage in built-in fonts
You must embed a TTF. There is no shortcut.

```bash
# 1. Download Noto Sans Bengali → src/assets/fonts/NotoSansBengali-Regular.ttf
# 2. Convert to a jsPDF font module using their fontconverter tool
#    (https://raw.githack.com/MrRio/jsPDF/master/fontconverter/fontconverter.html)
#    → produces NotoSansBengali-normal.js
```
```javascript
import jsPDF from 'jspdf'
import './assets/fonts/NotoSansBengali-normal.js'   // registers itself into jsPDF

export function exportAsPDF(record) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const isBn = record.config.language !== 'en'
  if (isBn) doc.setFont('NotoSansBengali', 'normal')
  // … render
}
```

**Caveat worth knowing before you build this:** jsPDF's text shaping does not do full complex-script ligature reordering. Bengali conjuncts (যুক্তাক্ষর) may render incorrectly even with the font embedded. If PDF fidelity for Bengali matters to you, the pragmatic route is: **export DOCX and let Word produce the PDF.** Consider restricting in-app PDF export to English scripts and saying so in the UI, rather than shipping subtly broken Bengali PDFs.

### F.3 Universal safety net
Always offer **Copy to clipboard** and **TXT export** (UTF-8, with BOM for Windows Notepad compatibility). These never break:
```javascript
const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' })
```

---

## APPENDIX G — Pricing Config

```javascript
// src/config/pricing.js
// USD per 1,000,000 tokens. VERIFY AGAINST PROVIDER PRICING PAGES BEFORE TRUSTING TOTALS.
// Last checked: ____________  ← fill this in and re-check quarterly

export const PRICING = {
  'claude-opus-5':              { in: null, out: null },
  'claude-sonnet-5':            { in: null, out: null },
  'claude-haiku-4-5-20251001':  { in: null, out: null },
  'gemini-3.6-flash':           { in: null, out: null },
  'gemini-3.5-flash-lite':      { in: null, out: null },
  'openai/gpt-oss-120b':        { in: null, out: null },
  'openai/gpt-oss-20b':         { in: null, out: null },
}

export function estimateCost(model, inTokens, outTokens) {
  const p = PRICING[model]
  if (!p?.in) return { usd: null, note: 'Rate not configured' }
  return { usd: (inTokens * p.in + outTokens * p.out) / 1_000_000, note: null }
}
```

I've deliberately left the rates `null` rather than filling in numbers I can't verify for today — a confidently wrong cost table is worse than an empty one. Fill them from each provider's pricing page when you set up the keys, and have the UI show *"Cost tracking not configured"* rather than `$0.00` while they're null.

**Rough sizing so you know what you're dealing with:** a 3-product, 60-second script is typically ~1,500 input tokens and ~1,200 output tokens. Whatever the rates are, this is a fractions-of-a-cent operation per script on mid-tier models. The reason to track cost is to catch a runaway retry loop, not to economise on individual generations.

---

## APPENDIX H — Mode B: Cloudflare Worker Proxy

Only if you deploy publicly. ~60 lines, free tier is generous.

```javascript
// worker.js — deploy with `wrangler deploy`
// Secrets: wrangler secret put CLAUDE_KEY / WC_KEY / WC_SECRET / WC_URL

const ALLOWED_ORIGIN = 'https://your-app.pages.dev'

const cors = (origin) => ({
  'Access-Control-Allow-Origin': origin === ALLOWED_ORIGIN ? origin : '',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'content-type,authorization',
})

export default {
  async fetch(req, env) {
    const origin = req.headers.get('Origin') ?? ''
    if (req.method === 'OPTIONS') return new Response(null, { headers: cors(origin) })
    if (origin !== ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 })

    const url = new URL(req.url)

    // --- Products ---
    if (url.pathname === '/api/products') {
      const target = new URL(env.WC_URL + '/wp-json/wc/v3/products')
      url.searchParams.forEach((v, k) => target.searchParams.set(k, v))
      const r = await fetch(target, {
        headers: { Authorization: 'Basic ' + btoa(`${env.WC_KEY}:${env.WC_SECRET}`) },
      })
      return new Response(await r.text(), {
        status: r.status,
        headers: {
          ...cors(origin),
          'content-type': 'application/json',
          'X-WP-Total': r.headers.get('X-WP-Total') ?? '0',
          'X-WP-TotalPages': r.headers.get('X-WP-TotalPages') ?? '0',
        },
      })
    }

    // --- AI generation ---
    if (url.pathname === '/api/generate' && req.method === 'POST') {
      const body = await req.json()
      // Validate: never forward arbitrary fields from the client
      const safe = {
        model: body.model,
        max_tokens: Math.min(body.max_tokens ?? 4096, 8192),
        system: String(body.system ?? '').slice(0, 20000),
        messages: body.messages,
      }
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': env.CLAUDE_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(safe),
      })
      return new Response(await r.text(), {
        status: r.status,
        headers: { ...cors(origin), 'content-type': 'application/json' },
      })
    }

    return new Response('Not found', { status: 404, headers: cors(origin) })
  },
}
```

**If you deploy this publicly, add rate limiting.** An open `/api/generate` endpoint with your key behind it is someone else's free AI service the moment it's discovered. Cloudflare's Rate Limiting rules, or a simple KV counter keyed by IP, is enough.

---

## APPENDIX I — Debugging Playbook

Known failure modes, in the order you'll hit them.

| Symptom | Cause | Fix |
|---|---|---|
| Products request fails, console shows CORS | No proxy | Add the Vite proxy (Plan §0), call `/wc-api/...` not the full URL |
| WooCommerce returns 401 with correct keys | Site on HTTP, or Basic auth stripped by host | WooCommerce requires HTTPS for key auth. Some hosts strip the Authorization header — fall back to `?consumer_key=&consumer_secret=` query params (dev only) |
| `X-WP-Total` header is undefined | CORS doesn't expose custom headers by default | Add `Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages` on the server, or read pagination from the proxy |
| Claude call fails from browser with a CORS message | Missing browser header | Add `anthropic-dangerous-direct-browser-access: true` |
| `InvalidCharacterError` from `btoa` | Bengali text in the stored value | `btoa(unescape(encodeURIComponent(str)))` and inverse on read |
| JSON.parse fails intermittently | Model wrapped output in fences or added preamble | Use `parseAiJson` **plus structured outputs** — see the correction below |
| Script generates but scenes total ≠ duration | No word budget in prompt | Pass explicit word count, not just seconds (App. D.1) |
| Bengali shows as boxes in the app | No webfont | Add Noto Sans Bengali link + `lang="bn"` on containers |
| Bengali empty in exported DOCX | Font not declared per run | App. F.1 |
| Bengali garbled in PDF | jsPDF shaping limitation | App. F.2 — route via DOCX |
| Zustand state resets on reload | `persist` name collides or storage throws | Check the `name`, wrap in `safeSetItem`, look for QuotaExceededError |
| Old products flash in after a new search | Stale response landed late | `AbortController`, abort on each new query |
| Everything vanished | User cleared browsing data | This is why backup/restore is Step 5, not Phase 3 |

> ### ⚠️ Correction: do NOT use an assistant prefill on Claude
>
> Earlier drafts of this table advised prefilling an assistant turn with `{` to
> force JSON. **That returns HTTP 400 on every current Claude model** — prefills
> were removed across the Opus 4.6+ family, including Opus 5. Two related
> parameters were removed at the same time and also 400: `temperature`, `top_p`,
> `top_k`, and the old `thinking.budget_tokens`.
>
> Use **structured outputs** instead, which enforce the shape rather than merely
> encouraging it:
>
> ```javascript
> output_config: {
>   effort: 'high',                              // replaces the thinking budget
>   format: { type: 'json_schema', schema: SCRIPT_SCHEMA },
> }
> ```
>
> Schema constraints worth knowing: every object needs `additionalProperties:
> false` and a `required` array; recursive schemas, `minLength`/`maximum` and
> friends are not supported. Gemini takes the same schema with uppercase type
> names and no `additionalProperties` (`aiService.toGeminiSchema` translates);
> Groq takes it as `response_format.json_schema`. `parseAiJson` stays as the
> safety net — schemas are enforced by Claude and Groq, advisory on Gemini.

**Instrument early.** A `DEBUG` flag in `useSettingsStore` that logs every AI request/response (prompt, provider, tokens, ms, raw text) into a rolling in-memory array, plus a "Copy debug log" button in Settings, will save more time than it costs to build.

### Failure modes found by actually running the app

These are not hypothetical — each one shipped, then broke, during the build.

| Symptom | Cause | Fix |
|---|---|---|
| App white-screens; "Maximum update depth exceeded" | A zustand selector that builds a **new array or object per call** — `useApiStore(s => s.availableProviders())`. zustand compares snapshots by reference, so a fresh array every render is an infinite loop, not a perf nit | Subscribe to primitives, derive with `useMemo`. See `useAvailableProviders` |
| Settings and API keys silently reset on every reload | The persist storage adapter prefixed keys with `acs_` **and** the store `name` already contained it → wrote/read `acs_acs_settings` | Prefix in exactly one place. `createSafeStorage` now uses raw `localStorage` |
| Unusable at 375px — sidebar eats the viewport | 232px sidebar against a 375px screen leaves ~143px of content | Force icons-only below 900px regardless of the saved preference (`useIsNarrow`) |
| `ECONNREFUSED 127.0.0.1:1` on every store request | Vite's `server.proxy` is **`http-proxy`**, which has no `router` option — that belongs to `http-proxy-middleware`. Vite accepts the key, ignores it, and uses the static `target` forever. Fails silently | Own the proxy: a `configureServer` middleware that reads the target per request. Also lets you return a JSON `message` the UI can show instead of an opaque 500 |
| Sync reports "1,547 products" but the catalogue is empty after reload | Full HTML descriptions are ~15 KB per product → **23 MB** for a real store, far past localStorage's ~5 MB. zustand's persist write throws, is swallowed, and memory disagrees with disk | Truncate descriptions at sync (600 chars — `promptBuilder` only ever uses 400, so nothing is lost). 23 MB → 3.7 MB. Plus `verifyPersisted()` reads the count back and raises `QUOTA_EXCEEDED` rather than letting the UI claim a success that will evaporate |

**The pattern in the last two:** both wrote successfully and reported success. Neither
a passing build nor a green UI proves a write landed — if state must survive a
reload, read it back.

---

## APPENDIX J — Conventions & Pre-Ship Checklist

### Naming
- Components `PascalCase.jsx`, utilities `camelCase.js`, stores `useThingStore.js`
- Boolean props read as assertions: `isGenerating`, `hasKey`, `canExport`
- Handlers `handleX` internally, `onX` as props
- localStorage keys always prefixed `acs_`

### Git
Branch per phase, commit per step: `feat(step-7): product search with debounce + abort`. Tag `v0.1-mvp` when the MVP acceptance criteria pass. When an AI session breaks something, `git diff` against the last good commit is the fastest way to find what changed — this is the main reason to bother committing at all in a solo project.

### Before you call it done
- [ ] All 13 acceptance criteria in the main plan pass
- [ ] `npm run build` succeeds; `npm run preview` works
- [ ] No `console.log` left outside the DEBUG flag
- [ ] No API key ever appears in a URL query string (they land in server logs and browser history)
- [ ] Backup export → clear all → import → everything restored
- [ ] Tested in one Chromium browser and one other
- [ ] Tested at 375px width
- [ ] Keyboard-only pass: can reach and activate every control
- [ ] Bengali script generated, edited, exported, and reopened without corruption
- [ ] README written: setup, WooCommerce key creation, proxy config, where keys live and the warning about them

### The README matters more than it seems
You will come back to this in four months having forgotten how the proxy is wired and which WooCommerce permissions you granted. Write it while it's fresh — setup steps, the key-security warning, and a "known limitations" section listing the Bengali PDF issue and the localStorage-only storage model.

---

## APPENDIX K — Frontend Design System ("Nocturne")

Appendix B fixes the *component API*. This fixes the *look* — the decisions that
make ten screens built in ten sessions read as one product. Everything here is
implemented in `src/index.css`; this appendix is the reasoning, so a later
session can extend the system instead of bolting something onto the side of it.

### K.1 The five decisions everything else follows from

**1. Dark-first.** People sit in this tool for an hour writing ad copy. A bright
white canvas is the wrong default for that. Light is fully supported (and
tested), not an afterthought — but dark is what opens.

**2. One accent, and it means something.** Violet `#8B5CF6` says exactly one
thing: *this is AI, this is active, this is primary*. It is never decoration.
Green, amber and red are reserved for state (success, warning, danger) and never
used for emphasis. When everything is highlighted, nothing is.

**3. Depth comes from surfaces, not shadows.** Three background levels plus a
hairline divider. Shadows are only for things that genuinely float — modals,
popovers, dropdowns. A card that casts a shadow while sitting flat on the page
is lying about its position.

```
--color-bg        #0a0a0f   the page
--color-surface   #12121a   cards, sidebar
--color-surface-2 #181822   raised things inside cards
--color-divider   #26262f   the hairline that separates them
```

**4. Four text weights, no more.** `--text-strong` / `--text-body` /
`--text-dim` / `--text-faint`. If you reach for a fifth, you are solving a
hierarchy problem with opacity, and it will not work.

**5. The accent ramp is derived, not enumerated.** Settings writes exactly one
value — `--color-accent`. Everything else (`-300`, `-700`, `-900`, the four
tint levels) is computed with `color-mix`. This is why a user-supplied hex
produces a *coherent* theme rather than a violet-ish border next to a teal
button. Verified: setting `#0EA5E9` re-themes buttons, nav, links, tags and
focus rings together.

```css
--color-accent-300: color-mix(in srgb, var(--color-accent) 68%, white);
--color-accent-700: color-mix(in srgb, var(--color-accent) 74%, black);
--accent-wash:      color-mix(in srgb, var(--color-accent) 10%, transparent);
--accent-hairline:  color-mix(in srgb, var(--color-accent) 24%, transparent);
```

### K.2 Type

| Role | Family | Notes |
|---|---|---|
| UI | Inter | `--font-body` |
| Bengali | Noto Sans Bengali → Nirmala UI | `--font-bengali`, applied by `[lang="bn"]` |
| Mono | JetBrains Mono | API keys, generated prompts, timestamps |

**Bengali needs more leading than Latin at the same size** — 1.85 vs 1.5. The
matra line above the glyph and the conjuncts below collide at Latin leading. This
is attached to `[lang='bn']`, not to a component, so it follows the *content*:
mark the containers, and every screen gets it for free. Do the same for
`lang="en"` on English blocks inside a Bengali script (visual directions, scene
titles) — mixed-script paragraphs are the norm here, not the exception.

Sizes are deliberately small and tight (12–13px body, 10px tracked-uppercase
eyebrows). This is a dense professional tool, not a marketing page.

### K.3 The scale

Radii `6 / 8 / 10 / 14 / 999`. Spacing is Tailwind's default 4px scale, but in
practice only `1.5 / 2 / 2.5 / 3 / 3.5 / 4 / 5` get used — a narrow palette used
consistently reads better than a wide one used precisely.

### K.4 Named patterns

These exist as classes so the *shape* of a thing is defined once and cannot
drift between sessions:

| Class | What it is |
|---|---|
| `.card` / `.elev-sm|md|lg` | Surface + hairline; elevation is separate and opt-in |
| `.btn` + `.btn-primary\|secondary\|ghost\|danger` | Radius, focus ring, transition, disabled state |
| `.input` | Includes the focus ring and `.input-error` variant |
| `.tag` + tone | The status pill, six tones |
| `.eyebrow` | 10px uppercase tracked label — used instead of nested headings |
| `.scroll-y` | `flex:1; min-height:0; overflow-y:auto` — the three lines every scrollable pane in a flex column needs, and the single most-repeated bug when omitted |

### K.5 Motion

Transitions are 150ms on colour only. Nothing slides, nothing bounces. Four
keyframes exist — `spin` (loading), `fade-up` (entering overlays), `pulse`
(skeletons), `glow` (the idle Generate button, the one place a flourish earns its
keep) — and all of them are switched off by the `prefers-reduced-motion` guard
in Appendix B.

### K.6 Non-negotiables

- **Never remove the focus ring.** One ring, everywhere, keyboard-only
  (`:focus-visible`). The keyboard pass in the pre-ship checklist depends on it.
- **Every list uses `EmptyState`.** Never render a bare "no results". An empty
  state is where you tell someone what to do next, and it is the screen a new
  user sees most.
- **Every destructive action needs a typed confirmation**, and sits next to the
  export that would have saved them.
- **State colour is never the only signal.** Status pills carry an icon or a
  label as well as a hue.
- **Wide content scrolls in its own container**, never the page body. Shot list,
  storyboard, calendar grid all set their own `min-width` + `overflow-x`.

### K.7 Responsive

Not a mobile app — it is a three-column authoring tool. The honest position:

- **≥1120px** — the Studio's three columns fit. Below that the Studio scrolls
  horizontally *by design*; product / config / output is the workflow.
- **<900px** — the sidebar force-collapses to icons regardless of the saved
  preference, and the toggle hides. A control that cannot change anything is
  worse than no control.
- **375px** — Dashboard, Library, Brands, Calendar and Settings are all usable.
  Verified, per the pre-ship checklist.

---

*Appendix v2.2 · companion to BUILD-PLAN v2.0 · July 2026*
*v2.2 — added Appendix K (design system); corrected the Claude prefill advice in
Appendix I; added the three runtime failure modes found during the build.*