# 🎬 Ai Product Content Studio BUILD MASTER PLAN

> **This document is written for AI (Claude Opus).** Read this file completely before writing any code. Follow every instruction in order. Do not skip any step.

---

## 📌 PROJECT OVERVIEW

**Project Name:** Ai Product Content Studio  
**Purpose:** An AI-powered web application that fetches products from a website API, lets users select products, and generates professional video scripts with scene breakdowns, shot lists, voiceovers, subtitles, and thumbnail prompts.  
**Primary Users:** Content creators, video producers, marketing teams  
**Primary Language of UI:** English (with Bengali output support in scripts)

---

## 🛠️ TECH STACK

| Layer | Technology |
|-------|-----------|
| Framework | React + Vite |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Routing | React Router v6 |
| HTTP Client | Axios |
| Charts | Recharts |
| Export (Word) | docx.js |
| Export (PDF) | jsPDF |
| Drag & Drop | @dnd-kit/core |
| Icons | Lucide React |
| Notifications | react-hot-toast |

**Install command:**
```bash
npm create vite@latest video-script-studio -- --template react
cd video-script-studio
npm install tailwindcss @tailwindcss/vite zustand react-router-dom axios recharts docx jspdf @dnd-kit/core @dnd-kit/sortable lucide-react react-hot-toast
```

---

## 📁 FOLDER STRUCTURE

Create exactly this structure:

```
video-script-studio/
├── public/
├── src/
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── ScriptStudio.jsx
│   │   ├── BrandMemory.jsx
│   │   ├── TeamWorkspace.jsx
│   │   ├── ContentCalendar.jsx
│   │   └── Settings.jsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.jsx
│   │   │   └── Navbar.jsx
│   │   ├── product/
│   │   │   ├── ProductSearch.jsx
│   │   │   └── ProductCard.jsx
│   │   ├── script/
│   │   │   ├── ScriptConfig.jsx
│   │   │   ├── ScriptOutput.jsx
│   │   │   ├── SceneBreakdown.jsx
│   │   │   └── ShotList.jsx
│   │   ├── voice/
│   │   │   ├── VoiceSettings.jsx
│   │   │   └── VoicePlayer.jsx
│   │   ├── tools/
│   │   │   ├── SubtitleGenerator.jsx
│   │   │   ├── ThumbnailPromptGenerator.jsx
│   │   │   └── ScriptScoring.jsx
│   │   └── shared/
│   │       ├── ApiKeyManager.jsx
│   │       └── ExportMenu.jsx
│   ├── store/
│   │   ├── useApiStore.js
│   │   ├── useScriptStore.js
│   │   └── useBrandStore.js
│   ├── services/
│   │   ├── productService.js
│   │   ├── aiService.js
│   │   └── voiceService.js
│   ├── utils/
│   │   ├── exportUtils.js
│   │   └── promptBuilder.js
│   ├── App.jsx
│   └── main.jsx
```

---

## 🔑 API KEYS — FULL LIST

Store all keys in `localStorage` with `btoa()` base64 encoding. Key name in storage: `vss_keys`.

| Slot | Key Name | Provider | Purpose |
|------|----------|----------|---------|
| 1 | `website_api_key` | User's Website | Fetch products |
| 2 | `website_api_url` | User's Website | Base URL for API |
| 3 | `claude_api_key` | Anthropic | Primary AI (script, scene, shot, subtitle, scoring) |
| 4 | `gemini_api_key` | Google | Fallback AI |
| 5 | `groq_api_key` | Groq | Fast fallback AI |
| 6 | `elevenlabs_api_key` | ElevenLabs | Realistic voice generation |
| 7 | `google_tts_key` | Google Cloud | Multi-language TTS |
| 8 | `openai_api_key` | OpenAI | Optional (DALL-E thumbnail prompts) |
| 9 | `custom_key_value` | Custom | Any future service |
| 10 | `custom_key_label` | — | Label for custom key |

---

## 🏗️ BUILD PHASES — STEP BY STEP

---

### ✅ PHASE 1 — Foundation (Build First)

#### STEP 1: App Shell + Routing + Layout

**What to build:**
- `App.jsx` with React Router routes for all 6 pages
- `Sidebar.jsx` with navigation links to all pages
- `Navbar.jsx` with page title and user actions
- Tailwind dark theme base (dark bg: `#0f1117`, card: `#1a1d27`, accent: `#6c63ff`)

**Routes:**
```
/              → Dashboard
/studio        → ScriptStudio
/brand         → BrandMemory
/team          → TeamWorkspace
/calendar      → ContentCalendar
/settings      → Settings
```

**Sidebar links (with icons):**
- 🏠 Dashboard
- 🎬 Script Studio
- 🧠 Brand Memory
- 👥 Team Workspace
- 📅 Content Calendar
- ⚙️ Settings

---

#### STEP 2: Zustand Stores

**`useApiStore.js`** — manages API keys:
```javascript
// State:
keys: {}           // all API keys object
setKey(name, value)
getKey(name)
loadKeys()         // load from localStorage on init
saveKeys()         // save to localStorage with btoa encoding
testConnection(keyName)  // ping test per provider
```

**`useScriptStore.js`** — manages script generation:
```javascript
// State:
selectedProducts: []
scriptConfig: {}
generatedScript: null
sceneBreakdown: []
shotList: []
subtitles: []
thumbnailPrompts: []
scriptScore: null
isGenerating: false
setSelectedProducts(products)
setScriptConfig(config)
setGeneratedScript(script)
clearAll()
```

**`useBrandStore.js`** — manages brand profiles:
```javascript
// State:
brands: []          // array of brand objects
activeBrand: null
addBrand(brand)
updateBrand(id, data)
deleteBrand(id)
setActiveBrand(id)
// Persist to localStorage key: 'vss_brands'
```

---

#### STEP 3: Settings Page — API Key Manager

**File:** `src/pages/Settings.jsx` + `src/components/shared/ApiKeyManager.jsx`

**UI Requirements:**
- Section title: "API Configuration"
- For each key slot, render a card with:
  - Provider logo/icon (emoji is fine)
  - Key name label
  - Password input field (type="password")
  - Show/Hide toggle button (eye icon)
  - "Test Connection" button → shows ✅ or ❌ with message
  - "Save" button per key
- Green success toast on save
- Website API URL field (text input, not password)
- Custom key card has an editable label field above the key input

**Test Connection logic per provider:**
- `website_api_key`: GET `{website_api_url}/wp-json/wc/v3/products?per_page=1` with auth header
- `claude_api_key`: POST `https://api.anthropic.com/v1/messages` with minimal test payload
- `elevenlabs_api_key`: GET `https://api.elevenlabs.io/v1/voices` with xi-api-key header
- `groq_api_key`: GET `https://api.groq.com/openai/v1/models` with Bearer token
- Others: show "Manual verification required"

---

### ✅ PHASE 2 — Product System

#### STEP 4: Product Service

**File:** `src/services/productService.js`

```javascript
// Functions to implement:

async function fetchProducts({ search, category, page, perPage })
// GET {website_api_url}/wp-json/wc/v3/products
// Auth: Basic btoa(consumer_key:consumer_secret) OR Bearer token
// Query params: search, category, page, per_page
// Returns: { products: [], total, totalPages }

async function fetchCategories()
// GET {website_api_url}/wp-json/wc/v3/products/categories
// Returns: array of { id, name }

async function fetchProductById(id)
// GET {website_api_url}/wp-json/wc/v3/products/{id}
// Returns: full product object
```

**Product object shape expected:**
```javascript
{
  id, name, slug, description, short_description,
  price, regular_price, sale_price,
  images: [{ src, alt }],
  categories: [{ id, name }],
  attributes: [{ name, options }],
  sku, stock_status, average_rating
}
```

**Also support custom API format:**
```javascript
// If website_api_url doesn't contain 'wp-json',
// use: GET {website_api_url}/products?search=&page=
// Map response fields based on common naming patterns
```

---

#### STEP 5: Product Search UI

**Files:** `src/components/product/ProductSearch.jsx` + `ProductCard.jsx`

**ProductSearch UI:**
- Search input with debounce (500ms)
- Category filter dropdown (loaded from API)
- Product grid (3 columns on desktop, 1 on mobile)
- Pagination controls (prev/next + page number)
- Loading skeleton cards while fetching
- "No products found" empty state
- Selected count badge: "3 products selected"
- "Clear Selection" button
- "Continue to Script Config →" button (appears when ≥1 product selected)

**ProductCard UI:**
- Product image (fallback: grey placeholder)
- Product name (truncated at 2 lines)
- Price (show sale price in red if on sale)
- Category badge
- Checkbox overlay (top-left corner)
- Selected state: purple border + checkmark
- Click anywhere on card to select/deselect

---

### ✅ PHASE 3 — Script Generation Engine

#### STEP 6: Prompt Builder

**File:** `src/utils/promptBuilder.js`

**Function:** `buildScriptPrompt(products, config, brand)`

Build a detailed prompt string using this template:

```
You are an expert video script writer for e-commerce product videos.

BRAND CONTEXT:
- Brand Name: {brand.name}
- Tone of Voice: {brand.tone}
- Writing Style: {brand.writingStyle}
- Forbidden Words: {brand.forbiddenWords.join(', ')}
- Preferred CTA: {brand.preferredCTA}

PRODUCT INFORMATION:
{for each product:}
- Product Name: {product.name}
- Price: {product.price}
- Description: {product.description}
- Key Features: {product.attributes}
- Category: {product.categories}

SCRIPT REQUIREMENTS:
- Video Type: {config.videoType}
- Tone: {config.tone}
- Language: {config.language}
- Duration: {config.duration}
- Target Audience: {config.targetAudience}

OUTPUT FORMAT (respond in valid JSON only):
{
  "hook": "opening line (first 3 seconds)",
  "problem_statement": "pain point addressed",
  "product_intro": "product introduction text",
  "scenes": [
    {
      "scene_number": 1,
      "title": "scene title",
      "duration": "seconds",
      "voiceover": "exact words to say",
      "visual_direction": "what to show on screen",
      "text_overlay": "any text on screen"
    }
  ],
  "social_proof": "testimonial or stat",
  "cta": "call to action text",
  "outro": "closing line",
  "estimated_total_duration": "seconds",
  "key_selling_points": ["point1", "point2"]
}

Write in {config.language}. Keep it engaging and conversion-focused.
```

---

#### STEP 7: AI Service

**File:** `src/services/aiService.js`

**Implement with failover chain:**

```javascript
async function generateScript(prompt) {
  // Try Claude first
  try {
    return await callClaude(prompt)
  } catch(e) {
    // Try Gemini
    try {
      return await callGemini(prompt)
    } catch(e) {
      // Try Groq last
      return await callGroq(prompt)
    }
  }
}

async function callClaude(prompt) {
  // POST https://api.anthropic.com/v1/messages
  // Headers: x-api-key, anthropic-version: 2023-06-01, content-type
  // Model: claude-opus-4-5 (use the latest available)
  // max_tokens: 4096
  // Parse response: data.content[0].text → JSON.parse()
}

async function callGemini(prompt) {
  // POST https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent
  // Query param: key={gemini_api_key}
  // Parse: data.candidates[0].content.parts[0].text → JSON.parse()
}

async function callGroq(prompt) {
  // POST https://api.groq.com/openai/v1/chat/completions
  // Header: Authorization: Bearer {groq_api_key}
  // Model: mixtral-8x7b-32768
  // Parse: data.choices[0].message.content → JSON.parse()
}

// Also export these for other features:
async function generateSceneBreakdown(script)
async function generateShotList(scenes)
async function generateSubtitles(voiceovers, duration)
async function generateThumbnailPrompts(product, script)
async function scoreScript(script, brand)
```

---

#### STEP 8: Script Config UI

**File:** `src/components/script/ScriptConfig.jsx`

**Layout:** Two-column form with clickable option cards (NOT dropdowns)

**Section 1 — Video Type** (pick one):
- 🎯 Product Review
- 📦 Unboxing
- ✨ Benefits-Focused
- ⚖️ Comparison
- 📚 Tutorial

**Section 2 — Tone** (pick one):
- 💼 Professional
- 😊 Casual
- ⚡ Energetic
- 💝 Emotional
- 😄 Humorous

**Section 3 — Language** (pick one):
- 🇧🇩 Bengali (বাংলা)
- 🇬🇧 English
- 🔀 Banglish (Mixed)

**Section 4 — Duration** (pick one):
- ⚡ 30 seconds
- 1️⃣ 1 minute
- 3️⃣ 3 minutes
- 5️⃣ 5 minutes
- ✏️ Custom (show number input)

**Section 5 — Target Audience:**
- Free text input: "Describe your target audience..."

**Section 6 — Voice Scope** (pick one):
- 🎙️ Voiceover/Narration only
- 📄 Full Script
- 🎬 Scene-by-Scene

**Section 7 — Brand Memory:**
- Dropdown to select saved brand (or "No Brand")

**Bottom:** Large "🚀 Generate Script" button (purple gradient)

---

### ✅ PHASE 4 — Script Output & Production Tools

#### STEP 9: Script Output Panel

**File:** `src/components/script/ScriptOutput.jsx`

**Layout:** Full-width panel with tabbed sections

**Tab 1 — Script:**
- Hook block (highlighted in gold/yellow)
- Problem Statement block
- Product Intro block
- Scene cards (numbered, expandable)
  - Each card: scene title, duration badge, voiceover text, visual direction, text overlay
  - Edit icon on each field (inline editing on click)
- Social Proof block
- CTA block (highlighted in green)
- Outro block

**Tab 2 — Scene Breakdown** (see Step 10)
**Tab 3 — Shot List** (see Step 11)
**Tab 4 — Voice** (see Step 12-13)
**Tab 5 — Tools** (Subtitle + Thumbnail + Score)

**Top action bar:**
- 📋 Copy All button
- 🔄 Regenerate button
- 📤 Export dropdown (TXT / DOCX / PDF / JSON)
- 💾 Save to Library button

---

#### STEP 10: Scene Breakdown Generator

**File:** `src/components/script/SceneBreakdown.jsx`

**Trigger:** Button "Generate Scene Breakdown" → calls `aiService.generateSceneBreakdown(script)`

**AI Prompt for scene breakdown:**
```
Given this video script, create a detailed scene-by-scene breakdown.
For each scene return JSON array:
[{
  "scene_number": 1,
  "title": "Scene title",
  "duration_seconds": 10,
  "mood": "energetic/calm/dramatic",
  "dialogue": "exact spoken words",
  "action": "what happens visually",
  "transition": "cut/fade/wipe/zoom"
}]
Script: {script JSON}
```

**UI:** Timeline view — horizontal scrollable cards with scene number, title, duration pill, mood badge, dialogue text, action notes, transition icon

---

#### STEP 11: Shot List Generator

**File:** `src/components/script/ShotList.jsx`

**Trigger:** Button "Generate Shot List" → calls `aiService.generateShotList(scenes)`

**AI Prompt:**
```
Based on these video scenes, create a professional shot list.
Return JSON array:
[{
  "scene_number": 1,
  "shot_number": "1A",
  "shot_type": "Close-up / Medium / Wide / Extreme Close-up / Over-the-shoulder",
  "camera_angle": "Eye level / Low angle / High angle / Dutch angle",
  "camera_movement": "Static / Pan left / Pan right / Zoom in / Zoom out / Dolly / Tilt",
  "subject": "what/who is in frame",
  "props_needed": ["prop1", "prop2"],
  "location": "suggested shooting location",
  "lighting": "Natural / Soft box / Rim light / etc",
  "b_roll": "suggested B-roll footage",
  "notes": "director notes"
}]
Scenes: {scenes JSON}
```

**UI:** Printable table with all columns, "Print Shot List" button, export as PDF

---

### ✅ PHASE 5 — Voice System

#### STEP 12: Voice Service

**File:** `src/services/voiceService.js`

```javascript
// Provider 1: Browser TTS (free, no API key)
function browserTTS(text, options) {
  // Use window.speechSynthesis
  // options: { rate: 1, pitch: 1, volume: 1, voice: voiceName, lang: 'bn-BD' or 'en-US' }
  // Return: SpeechSynthesisUtterance (can pause/stop)
}

// Provider 2: ElevenLabs
async function elevenLabsTTS(text, voiceId, options) {
  // POST https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
  // Header: xi-api-key: {elevenlabs_api_key}
  // Body: { text, model_id: "eleven_multilingual_v2", voice_settings: { stability: 0.5, similarity_boost: 0.75 } }
  // Returns: audio blob → create object URL
}

// Provider 3: Google TTS
async function googleTTS(text, options) {
  // POST https://texttospeech.googleapis.com/v1/text:synthesize?key={google_tts_key}
  // Body: { input: { text }, voice: { languageCode: 'bn-BD', name: 'bn-BD-Standard-A' }, audioConfig: { audioEncoding: 'MP3' } }
  // Returns: base64 audio → decode → blob
}

// Utility
function downloadAudioBlob(blob, filename) {
  // Create download link and trigger download
}

// Get available voices per provider
async function getVoices(provider)
```

---

#### STEP 13: Voice Player UI

**File:** `src/components/voice/VoicePlayer.jsx`

**UI Layout:**

**Row 1 — Provider Selector:**
- 3 tabs: Browser TTS | ElevenLabs | Google TTS
- Show "(Free)" badge on Browser TTS
- Show "(API Key Required)" if key not set

**Row 2 — Voice Selector:**
- Dropdown with available voices for selected provider
- Language filter (Bengali / English / Auto)

**Row 3 — Settings:**
- Speed slider: 0.5x → 2.0x
- Pitch slider (Browser TTS only): -2 → +2
- Volume slider: 0 → 100%

**Row 4 — Scope Selector (what to voice):**
- Radio buttons: Full Script | Voiceover Only | Scene-by-Scene

**Row 5 — Controls:**
- ▶️ Play / ⏸️ Pause / ⏹️ Stop buttons
- Progress bar with time display
- Animated waveform (CSS animation) while playing

**Row 6 — Download:**
- "⬇️ Download MP3" button (full script)
- If Scene-by-Scene mode: list of scenes with individual play + download buttons

---

### ✅ PHASE 6 — Extra AI Tools

#### STEP 14: Subtitle Generator

**File:** `src/components/tools/SubtitleGenerator.jsx`

**Trigger:** Button "Generate Subtitles" → calls `aiService.generateSubtitles()`

**AI Prompt:**
```
Convert these voiceover texts with estimated durations into subtitle blocks.
Total video duration: {duration} seconds
Voiceovers: {voiceovers array}

Return JSON array:
[{
  "index": 1,
  "start_time": "00:00:00,000",
  "end_time": "00:00:03,500",
  "text": "subtitle text here"
}]
Keep each subtitle block 1-2 lines max. 
Format timestamps as SRT standard: HH:MM:SS,mmm
```

**UI:**
- Preview table: Index | Timestamp | Text (editable)
- "Export SRT" button → downloads `.srt` file
- "Export VTT" button → downloads `.vtt` file
- "Copy All" button

**SRT file format:**
```
1
00:00:00,000 --> 00:00:03,500
First subtitle text

2
00:00:03,500 --> 00:00:07,000
Second subtitle text
```

---

#### STEP 15: Thumbnail Prompt Generator

**File:** `src/components/tools/ThumbnailPromptGenerator.jsx`

**Trigger:** Button "Generate Thumbnail Prompts" → calls `aiService.generateThumbnailPrompts()`

**AI Prompt:**
```
Create 3 different thumbnail/poster prompts for this product video.
Product: {product.name}
Hook: {script.hook}
Target: {config.targetAudience}

Return JSON:
{
  "midjourney": {
    "prompt": "detailed MJ prompt with --ar 16:9 --v 6",
    "style": "photorealistic/illustration/3D",
    "mood": "energetic/professional/warm",
    "color_palette": ["#hex1", "#hex2"],
    "text_overlay": "suggested title text"
  },
  "dalle3": {
    "prompt": "DALL-E 3 optimized prompt",
    "size": "1792x1024",
    "style": "vivid/natural"
  },
  "firefly": {
    "prompt": "Adobe Firefly prompt",
    "content_type": "photo/graphic/art",
    "effects": ["lighting effect", "color grade"]
  }
}
```

**UI:**
- 3 cards side by side (MJ / DALL-E / Firefly)
- Each card: platform badge, prompt text (monospace), style info, color swatches
- "Copy Prompt" button per card
- "Generate New Variations" button

---

#### STEP 16: Script Scoring

**File:** `src/components/tools/ScriptScoring.jsx`

**Trigger:** Auto-runs after script generation OR manual "Score My Script" button

**AI Prompt:**
```
Analyze this video script and score it on these dimensions (0-100):
Script: {script JSON}
Brand Guidelines: {brand JSON}

Return JSON:
{
  "hook_strength": { "score": 85, "feedback": "Strong opening that grabs attention" },
  "clarity": { "score": 72, "feedback": "Message is clear but could be more concise" },
  "engagement": { "score": 90, "feedback": "Excellent pacing and energy" },
  "cta_effectiveness": { "score": 68, "feedback": "CTA could be more specific and urgent" },
  "brand_consistency": { "score": 95, "feedback": "Perfectly matches brand tone" },
  "overall_score": 82,
  "top_strength": "The hook is excellent",
  "top_improvement": "Make the CTA more specific",
  "quick_fixes": ["Fix 1", "Fix 2", "Fix 3"]
}
```

**UI:**
- Overall score: large circular gauge (animated, color: red<60, yellow<80, green≥80)
- 5 dimension bars: label + animated progress bar + score number + feedback text
- "Top Strength" green card
- "Top Improvement" yellow card  
- "Quick Fixes" list (3 items with ✏️ icon)
- "Apply Suggestions" button → regenerates script with improvements

---

### ✅ PHASE 7 — Brand Memory

#### STEP 17: Brand Memory System

**File:** `src/pages/BrandMemory.jsx`

**Left Panel — Brand List:**
- List of saved brands with logo, name
- "+ New Brand" button
- Delete button per brand
- Click to select/edit

**Right Panel — Brand Editor:**

**Section 1 — Basic Info:**
- Brand Name (text input)
- Logo Upload (image input, preview shown)
- Brand Color (color picker)
- Industry/Category (text)

**Section 2 — Voice & Tone:**
- Tone of Voice (textarea): "Describe how the brand speaks..."
- Writing Style: Radio buttons → Formal | Semi-formal | Casual | Playful
- Personality traits: Multi-select tags → Professional / Friendly / Bold / Luxurious / Youthful / Trustworthy

**Section 3 — Content Rules:**
- Forbidden Words (tag input): type word + Enter to add
- Competitor names to avoid (tag input)
- Required disclaimers (textarea)

**Section 4 — CTA Library:**
- Preferred CTA phrases (tag input)
- Emergency/sale CTA variants (tag input)

**Section 5 — Target Demographics:**
- Age range: dual-handle slider (18-65)
- Gender focus: All / Male / Female / Non-binary
- Location focus (text)
- Income level: Budget / Mid-range / Premium / Luxury

**Bottom:** "Save Brand" button (purple) + "Set as Active Brand" toggle

---

### ✅ PHASE 8 — Team & Calendar

#### STEP 18: Team Workspace

**File:** `src/pages/TeamWorkspace.jsx`

**Layout:** Kanban board with 4 columns

**Columns:**
1. 📝 **Draft** — grey header
2. 👁️ **In Review** — yellow header
3. ✅ **Approved** — green header
4. 🚀 **Published** — blue header

**Script Card contains:**
- Script/Video title
- Product name + thumbnail
- Assignee avatar + name
- Due date badge (red if overdue)
- Language badge (EN/BN)
- Video type badge
- Last edited timestamp
- Comment count icon
- Click to open detail modal

**Card Detail Modal:**
- Full script preview
- Status change dropdown
- Assignee change
- Comment thread (add comment input + list)
- Activity log (who did what, when)
- Export buttons

**Drag & Drop:** Cards draggable between columns using @dnd-kit

**Top bar:**
- Filter by assignee
- Filter by product
- Search by title
- "+ New Script" button

**Data Storage:** localStorage key `vss_team_scripts`

---

#### STEP 19: Content Calendar

**File:** `src/pages/ContentCalendar.jsx`

**View Toggle:** Month View | Week View | List View

**Month View:**
- Standard calendar grid
- Each day cell shows script cards (pill format: colored by status)
- Click on day to add/view scripts
- Overflow: "+N more" link

**Week View:**
- 7-column grid with time slots
- Drag scripts from sidebar onto calendar

**Right Sidebar (always visible):**
- Unscheduled scripts list (draggable)
- Filter: All / Draft / Approved
- Search scripts

**Calendar Legend:**
- Grey dot = Draft
- Yellow dot = In Review
- Green dot = Approved
- Blue dot = Published

**Data:** Extend `vss_team_scripts` with `scheduled_date` field

---

### ✅ PHASE 9 — Dashboard

#### STEP 20: Dashboard

**File:** `src/pages/Dashboard.jsx`

**Top Stats Row (4 cards):**
- 📄 Total Scripts This Month
- ✅ Scripts Approved
- 🎙️ Scripts with Voice
- 📅 Scheduled This Week

**Row 2 — Charts:**
- Left: Donut chart — Scripts by Status (Draft/Review/Approved/Published)
- Right: Bar chart — Scripts per day (last 14 days)

**Row 3 — Two Columns:**
- Left: Recent Scripts (last 5, with status badge + edit link)
- Right: Upcoming Calendar (next 7 days with scheduled scripts)

**Row 4 — Quick Actions:**
- 🎬 New Script (→ /studio)
- 📦 Browse Products (→ /studio#products)
- 🧠 Manage Brands (→ /brand)
- 📅 Open Calendar (→ /calendar)

---

### ✅ PHASE 10 — Export System

#### STEP 21: Export Utilities

**File:** `src/utils/exportUtils.js`

```javascript
// Export as TXT
function exportAsTXT(script) {
  // Format: plain text with section labels
  // Trigger download as script-{productName}-{date}.txt
}

// Export as DOCX
function exportAsDOCX(script) {
  // Use docx.js library
  // Include: title, all sections with headings
  // Bold labels, regular content
  // Page margins, font: Calibri 11pt
}

// Export as PDF
function exportAsPDF(script) {
  // Use jsPDF
  // Same structure as DOCX
  // A4 page size
}

// Export as JSON
function exportAsJSON(script, sceneBreakdown, shotList) {
  // Full data dump as formatted JSON file
}

// Export SRT
function exportAsSRT(subtitles) {
  // Standard SRT format
}

// Export for WhatsApp
function exportAsWhatsApp(script) {
  // Compact text with emoji section markers
  // Copy to clipboard
}
```

---

## 🎨 DESIGN SYSTEM

### Colors (Tailwind custom + CSS variables):
```css
--bg-primary: #0f1117
--bg-card: #1a1d27
--bg-hover: #22263a
--accent-primary: #6c63ff
--accent-secondary: #a78bfa
--success: #10b981
--warning: #f59e0b
--danger: #ef4444
--text-primary: #f1f5f9
--text-secondary: #94a3b8
--border: #2d3148
```

### Typography:
- Headings: font-bold, tracking-tight
- Body: font-normal, leading-relaxed
- Code/Monospace: font-mono (for prompts, SRT, JSON)

### Component Patterns:
- Cards: rounded-xl, border border-[var(--border)], bg-[var(--bg-card)], p-5
- Buttons primary: bg-[var(--accent-primary)] hover:bg-violet-700, rounded-lg, px-4 py-2, text-white, font-medium
- Buttons secondary: border border-[var(--border)] bg-transparent hover:bg-[var(--bg-hover)]
- Inputs: bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg px-3 py-2 text-white focus:border-violet-500
- Tabs: underline style, active tab has accent color underline

---

## ⚠️ IMPORTANT RULES FOR AI

1. **Never hardcode API keys** — always read from Zustand store / localStorage
2. **Always handle API errors gracefully** — show toast notification with error message
3. **Always show loading states** — spinner or skeleton while fetching/generating
4. **Validate before API calls** — check if required keys are set, show Settings prompt if missing
5. **Parse AI responses safely** — wrap JSON.parse in try/catch, strip markdown fences first
6. **Mobile responsive** — all pages must work on mobile screens (min 375px width)
7. **No form tags** — use div + onClick handlers, not HTML form submit
8. **Keep components focused** — one file per component, no file over 300 lines
9. **Use Zustand for all shared state** — no prop drilling more than 2 levels
10. **Test connection before first use** — if API key test fails, show clear error message

---

## 🔄 DATA FLOW DIAGRAM

```
User opens app
      ↓
Settings: Enter API Keys → Save to localStorage
      ↓
ScriptStudio page loads
      ↓
Step 1: Product Search
  → productService.fetchProducts() 
  → Display grid → User selects products
      ↓
Step 2: Script Config
  → User picks: Type, Tone, Language, Duration, Audience, Brand
      ↓
Step 3: Generate Script
  → promptBuilder.buildScriptPrompt(products, config, brand)
  → aiService.generateScript(prompt)  [Claude → Gemini → Groq failover]
  → Store in useScriptStore
      ↓
Step 4: View & Edit Script
  → ScriptOutput component renders structured script
  → User can edit inline
      ↓
Step 5: Generate Production Assets (all optional, any order)
  → Scene Breakdown → aiService.generateSceneBreakdown()
  → Shot List → aiService.generateShotList()
  → Subtitles → aiService.generateSubtitles()
  → Thumbnail Prompts → aiService.generateThumbnailPrompts()
  → Script Score → aiService.scoreScript()
      ↓
Step 6: Voice Over
  → VoicePlayer → voiceService [Browser/ElevenLabs/Google]
  → Play in browser + Download MP3
      ↓
Step 7: Export
  → exportUtils → TXT / DOCX / PDF / SRT / JSON / WhatsApp
      ↓
Step 8: Save to Team
  → Add to TeamWorkspace → Assign → Set status
  → Schedule in ContentCalendar
```

---

## 📋 BUILD ORDER CHECKLIST

Follow this exact order. Complete each step before moving to next.

- [ ] Step 1: Project setup + folder structure + install dependencies
- [ ] Step 2: Tailwind config + global CSS variables + App.jsx routing
- [ ] Step 3: Sidebar + Navbar layout components
- [ ] Step 4: Zustand stores (useApiStore, useScriptStore, useBrandStore)
- [ ] Step 5: Settings page + ApiKeyManager component
- [ ] Step 6: productService.js
- [ ] Step 7: ProductSearch + ProductCard components
- [ ] Step 8: promptBuilder.js utility
- [ ] Step 9: aiService.js with failover
- [ ] Step 10: ScriptConfig component
- [ ] Step 11: ScriptOutput component (tabs structure)
- [ ] Step 12: SceneBreakdown component
- [ ] Step 13: ShotList component
- [ ] Step 14: voiceService.js
- [ ] Step 15: VoicePlayer component
- [ ] Step 16: SubtitleGenerator component
- [ ] Step 17: ThumbnailPromptGenerator component
- [ ] Step 18: ScriptScoring component
- [ ] Step 19: BrandMemory page
- [ ] Step 20: TeamWorkspace page (Kanban)
- [ ] Step 21: ContentCalendar page
- [ ] Step 22: Dashboard page
- [ ] Step 23: exportUtils.js
- [ ] Step 24: ExportMenu component
- [ ] Step 25: Final integration + testing + responsive fixes

---

## 💬 HOW TO USE THIS DOCUMENT WITH CLAUDE OPUS

**Session Start Prompt Template:**
```
I am building a React web application called "Video Script Studio".
Here is the complete project specification: [paste this entire MD file]

I have already completed these steps: [list completed steps]

The current codebase looks like this:
[paste relevant existing files]

Please now complete: Step [N] — [Step Name]
Follow the specifications exactly. 
Return complete, production-ready code for all files needed in this step.
Do not use placeholder comments — write all the actual code.
```

**After each step:**
1. Copy the generated code into your project
2. Test it in the browser
3. Note any bugs or issues
4. In next session: paste this doc + completed steps list + current code + issue description

---

*Document Version: 1.0 | Project: Video Script Studio | Stack: React + Vite + Tailwind + Zustand*
