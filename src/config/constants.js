/** Option lists, limits, enums. If a screen needs a fixed list, it lives here. */

export const STORAGE_PREFIX = 'acs_'

export const MAX_SELECTED_PRODUCTS = 5
export const MAX_HISTORY = 10 // undo depth in useScriptStore
export const MAX_LIBRARY_RECORDS = 200 // soft cap before we warn about quota
export const PROMPT_MAX_CHARS = 500

export const VIDEO_TYPES = [
  { value: 'review', label: 'Product Review', icon: '🎯' },
  { value: 'unboxing', label: 'Unboxing', icon: '📦' },
  { value: 'benefits', label: 'Benefits', icon: '✨' },
  { value: 'comparison', label: 'Comparison', icon: '⚖️' },
  { value: 'tutorial', label: 'Tutorial', icon: '🛠️' },
  // The offer ad. Distinct from Review, whose brief tells the model to admit a
  // limitation to build trust — the opposite of what a promotion needs.
  { value: 'promo', label: 'Promotional', icon: '🔥' },
]

export const TONES = [
  { value: 'professional', label: 'Professional', icon: '💼' },
  { value: 'casual', label: 'Casual', icon: '😊' },
  { value: 'energetic', label: 'Energetic', icon: '⚡' },
  { value: 'emotional', label: 'Emotional', icon: '💝' },
  { value: 'humorous', label: 'Humorous', icon: '😄' },
]

export const LANGUAGES = [
  { value: 'bn', label: 'Bengali', icon: '🇧🇩', htmlLang: 'bn' },
  { value: 'en', label: 'English', icon: '🇬🇧', htmlLang: 'en' },
  { value: 'banglish', label: 'Banglish', icon: '🔀', htmlLang: 'en' },
]

export const languageMeta = (code) => LANGUAGES.find((l) => l.value === code) ?? LANGUAGES[0]

/**
 * Words per second by language. Bengali is slower to read aloud than English at
 * the same word count — the words are longer and conjuncts slow delivery. These
 * feed the word budget in the system prompt, which is the only thing that
 * actually keeps scene durations summing to the target.
 */
export const WORDS_PER_SECOND = { bn: 2.1, banglish: 2.3, en: 2.6 }

export const DURATIONS = [
  { value: 30, label: '30s' },
  { value: 60, label: '1 min' },
  { value: 180, label: '3 min' },
  { value: 300, label: '5 min' },
]

export const VOICE_SCOPES = [
  { value: 'voiceover', label: 'Voiceover Only', icon: '🎙️' },
  { value: 'full', label: 'Full Script', icon: '📄' },
  { value: 'scene', label: 'Scene by Scene', icon: '🎬' },
]

/**
 * Promotion controls.
 *
 * These steer how an offer is *used*, never whether one exists. The product data
 * carries price and salePrice; the prompt is explicit that nothing may be
 * invented, because a script promising a discount the shop is not running is
 * worse than a flat one.
 */
export const OFFER_TYPES = [
  { value: 'none', label: 'No specific offer' },
  { value: 'discount', label: 'Discount' },
  { value: 'bundle', label: 'Bundle deal' },
  { value: 'free_delivery', label: 'Free delivery' },
  { value: 'gift', label: 'Gift with purchase' },
  { value: 'limited_time', label: 'Limited-time offer' },
]

export const PRICE_EMPHASIS = [
  { value: 'none', label: 'Do not mention price' },
  { value: 'mention', label: 'Mention once' },
  { value: 'anchor', label: 'Repeat and anchor' },
]

export const URGENCY_LEVELS = [
  { value: 'none', label: 'No urgency' },
  { value: 'gentle', label: 'Gentle' },
  { value: 'strong', label: 'Strong' },
]

export const OCCASIONS = [
  { value: 'none', label: 'No occasion' },
  { value: 'eid', label: 'Eid' },
  { value: 'ramadan', label: 'Ramadan' },
  { value: 'puja', label: 'Puja' },
  { value: 'winter', label: 'Winter' },
  { value: 'new_year', label: 'New Year' },
]

/** Customer controls, alongside the free-text target audience. */
export const AWARENESS_STAGES = [
  { value: 'cold', label: 'Never heard of it' },
  { value: 'comparing', label: 'Comparing options' },
  { value: 'existing', label: 'Already a customer' },
]

export const AGE_RANGES = [
  { value: '', label: 'Any age' },
  { value: '18-24', label: '18–24' },
  { value: '25-34', label: '25–34' },
  { value: '35-44', label: '35–44' },
  { value: '45+', label: '45+' },
]

export const GENDERS = [
  { value: 'any', label: 'Any' },
  { value: 'women', label: 'Women' },
  { value: 'men', label: 'Men' },
]

export const LOCATIONS = [
  { value: '', label: 'Nationwide' },
  { value: 'dhaka', label: 'Dhaka' },
  { value: 'chattogram', label: 'Chattogram' },
  { value: 'outside_cities', label: 'Outside major cities' },
]

export const SCRIPT_STATUSES = [
  { value: 'draft', label: 'Draft', icon: '📝', tone: 'neutral', color: '#a1a1aa' },
  { value: 'review', label: 'In Review', icon: '👁️', tone: 'warning', color: '#fbbf24' },
  { value: 'approved', label: 'Approved', icon: '✅', tone: 'success', color: '#4ade80' },
  { value: 'published', label: 'Published', icon: '🚀', tone: 'accent', color: '#8b5cf6' },
]

export const statusMeta = (value) =>
  SCRIPT_STATUSES.find((s) => s.value === value) ?? SCRIPT_STATUSES[0]

export const WRITING_STYLES = ['Formal', 'Semi-formal', 'Casual', 'Playful']

export const INDUSTRIES = [
  'Skincare & Beauty',
  'Electronics',
  'Fashion & Apparel',
  'Food & Beverage',
  'Health & Wellness',
  'Home & Living',
  'Other',
]

export const PROMPT_TEMPLATES = [
  {
    label: '⚡ Emotional Hook',
    text: 'Open with an emotional moment the buyer recognises from their own day. Keep the CTA warm, not pushy.',
  },
  {
    label: '🎯 Hard Sell',
    text: 'Lead with the single strongest benefit in the first three seconds. Repeat the price twice. Close hard.',
  },
  {
    label: '📢 Urgency CTA',
    text: 'Build toward a time-limited close. Only reference a discount or deadline if it is present in the product data.',
  },
]

/** Accent presets for Settings → Appearance. */
export const ACCENT_PRESETS = [
  '#8B5CF6',
  '#6366F1',
  '#0EA5E9',
  '#10B981',
  '#F59E0B',
  '#EC4899',
]

export const FONT_SCALES = [
  { value: 'small', label: 'Small', scale: 0.9375 },
  { value: 'medium', label: 'Medium', scale: 1 },
  { value: 'large', label: 'Large', scale: 1.0625 },
]

/**
 * The JSON shape every generation must return. Sent to the model verbatim as
 * the schema, and used to validate what comes back — one definition, so a
 * change here can't drift out of sync with the parser.
 */
export const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    hook: { type: 'string' },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          duration_seconds: { type: 'number' },
          voiceover: { type: 'string' },
          on_screen_text: { type: 'string' },
          visual_direction: { type: 'string' },
          mood: { type: 'string' },
          transition: { type: 'string' },
        },
        required: [
          'title',
          'duration_seconds',
          'voiceover',
          'on_screen_text',
          'visual_direction',
          'mood',
          'transition',
        ],
        additionalProperties: false,
      },
    },
    cta: { type: 'string' },
    claims_used: { type: 'array', items: { type: 'string' } },
    hashtags: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'hook', 'scenes', 'cta', 'claims_used', 'hashtags'],
  additionalProperties: false,
}

export const FEEDBACK_SCHEMA = {
  type: 'object',
  properties: {
    hook: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['strong', 'adequate', 'weak'] },
        why: { type: 'string' },
        rewrite_suggestion: { type: 'string' },
      },
      required: ['verdict', 'why', 'rewrite_suggestion'],
      additionalProperties: false,
    },
    clarity: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['strong', 'adequate', 'weak'] },
        why: { type: 'string' },
      },
      required: ['verdict', 'why'],
      additionalProperties: false,
    },
    pacing: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['strong', 'adequate', 'weak'] },
        why: { type: 'string' },
      },
      required: ['verdict', 'why'],
      additionalProperties: false,
    },
    cta: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['strong', 'adequate', 'weak'] },
        why: { type: 'string' },
        rewrite_suggestion: { type: 'string' },
      },
      required: ['verdict', 'why', 'rewrite_suggestion'],
      additionalProperties: false,
    },
    brand_fit: {
      type: 'object',
      properties: {
        verdict: { type: 'string', enum: ['strong', 'adequate', 'weak'] },
        why: { type: 'string' },
      },
      required: ['verdict', 'why'],
      additionalProperties: false,
    },
    unsupported_claims: { type: 'array', items: { type: 'string' } },
    biggest_strength: { type: 'string' },
    biggest_weakness: { type: 'string' },
    three_quick_fixes: { type: 'array', items: { type: 'string' } },
  },
  required: [
    'hook',
    'clarity',
    'pacing',
    'cta',
    'brand_fit',
    'unsupported_claims',
    'biggest_strength',
    'biggest_weakness',
    'three_quick_fixes',
  ],
  additionalProperties: false,
}

export const SUBTITLE_SCHEMA = {
  type: 'object',
  properties: {
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: { sceneIndex: { type: 'number' }, text: { type: 'string' } },
        required: ['sceneIndex', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['blocks'],
  additionalProperties: false,
}
