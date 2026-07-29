import { SCRIPT_SCHEMA, WORDS_PER_SECOND } from '../config/constants'
import { truncate, wordCount } from './text'

/** APPENDIX D — the complete prompt library. Every prompt is a named export. */

const LANGUAGE_RULES = {
  bn: `- Write all voiceover and on-screen text in natural, colloquial Dhaka Bengali (চলিত ভাষা), the way people actually speak — not literary or formal Bengali (সাধু ভাষা).
- Everyday English loanwords that Bangladeshis genuinely use in speech (যেমন: ডেলিভারি, অর্ডার, ব্যাটারি, চার্জ) are fine in Bengali script.
- Prices in Bengali: "মাত্র ২,৪৫০ টাকা".`,

  en: `- Write in clear, conversational English. Short sentences. Active voice. No corporate jargon.`,

  banglish: `- Write in Banglish: Bengali sentence structure and vocabulary in Latin script, mixed with English words, the way Bangladeshi users write on Facebook.
- Example register: "Ei fan ta 8 ghonta obdi chole, load-shedding e ar tension nai."
- Do not write formal transliteration — write how people actually type.`,
}

const VIDEO_TYPE_BRIEFS = {
  review:
    'Product review — honest assessment, lead with the strongest real benefit, acknowledge one limitation to build trust.',
  unboxing:
    'Unboxing — sensory and sequential. What is in the box, first impressions, build quality moments.',
  benefits: `Benefits-focused — every scene answers "what does this change in the buyer's day".`,
  comparison:
    'Comparison — contrast the products supplied against each other on the dimensions that matter to the buyer. Never name a competitor brand not present in the data.',
  tutorial: 'Tutorial — show the product solving a specific task, step by step.',
  promo: `Promotional — this is an offer advertisement, not a review. Open on the deal itself in the first three seconds, keep every scene driving toward it, and close hard on the call to action. Do not hedge and do not list drawbacks. Use only the discount, sale price or offer that appears in the product data above; if there is none, sell on value and never invent a deal.`,
}

/** Derives the word budget from duration + language. Called before every prompt. */
export function buildPromptConfig(config) {
  const wps = WORDS_PER_SECOND[config.language] ?? WORDS_PER_SECOND.en
  return {
    ...config,
    wps,
    wordBudget: Math.round(config.durationSeconds * wps),
  }
}

const LABELS = {
  offerType: {
    discount: 'a discount',
    bundle: 'a bundle deal',
    free_delivery: 'free delivery',
    gift: 'a free gift with purchase',
    limited_time: 'a limited-time offer',
  },
  priceEmphasis: {
    none: 'Do not state the price at all.',
    mention: 'State the price once, plainly.',
    anchor: 'State the price more than once and anchor it against the original price.',
  },
  urgency: {
    gentle: 'Close with light urgency — an invitation, not pressure.',
    strong: 'Close with strong urgency. Make the cost of waiting explicit.',
  },
  occasion: {
    eid: 'Eid',
    ramadan: 'Ramadan',
    puja: 'Puja',
    winter: 'winter',
    new_year: 'the New Year',
  },
  awareness: {
    cold: 'has never heard of this product — establish the problem before the product',
    comparing: 'is comparing similar products — lead with what makes this one different',
    existing: 'has already bought from this shop — skip the basics and deepen the relationship',
  },
  gender: { women: 'women', men: 'men' },
  location: {
    dhaka: 'in Dhaka',
    chattogram: 'in Chattogram',
    outside_cities: 'outside the major cities, where delivery time matters more',
  },
}

/** One sentence describing the buyer, from the structured fields plus free text. */
function audienceLine(config) {
  const who = [
    LABELS.gender[config.gender],
    config.ageRange && `aged ${config.ageRange}`,
    LABELS.location[config.location],
  ].filter(Boolean)

  const parts = [
    who.length ? who.join(' ') : null,
    config.targetAudience || null,
  ].filter(Boolean)

  const base = parts.join(' — ') || 'general Bangladeshi online shoppers'
  const stage = LABELS.awareness[config.awareness]

  return `${base}${stage ? `. The viewer ${stage}` : ''}${
    config.painPoint ? `. Their main problem: ${config.painPoint}` : ''
  }`
}

/**
 * Promotion instructions. Only the lines that say something are emitted — a
 * brief padded with "Offer: none" spends tokens telling the model to ignore
 * things.
 *
 * Price is the exception and is always stated, including at its default: how
 * hard a script leans on the number is the biggest single lever on it, and
 * leaving that to chance produced scripts that either never named the price or
 * repeated it in every scene.
 *
 * The no-fabrication rule is repeated here rather than left to the system
 * prompt: this is the one block that invites the model to talk about deals, so
 * the guard belongs next to the invitation.
 */
function promotionBlock(config) {
  const lines = []

  if (config.offerType !== 'none')
    lines.push(
      `Offer: build the close around ${LABELS.offerType[config.offerType]} — but ONLY if the product data above actually shows it. If it does not, write the script without any offer and never invent one.`,
    )

  if (config.priceEmphasis) lines.push(`Price: ${LABELS.priceEmphasis[config.priceEmphasis]}`)
  if (LABELS.urgency[config.urgency]) lines.push(`Urgency: ${LABELS.urgency[config.urgency]}`)

  if (config.occasion !== 'none')
    lines.push(
      `Occasion: frame the hook and CTA around ${LABELS.occasion[config.occasion]}, naturally — do not force it into every line.`,
    )

  return lines.length ? `\nPROMOTION\n${lines.join('\n')}\n` : ''
}

// ── D.1 System prompt (all generations) ──────────────────────────────────────
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
${LANGUAGE_RULES[config.language] ?? LANGUAGE_RULES.en}`

// ── D.2 Script generation (user prompt) ─────────────────────────────────────
export const buildScriptPrompt = (products, config, brand) => `${
  brand
    ? `BRAND CONTEXT
Name: ${brand.name}
Tone of voice: ${brand.tone}
Writing style: ${brand.writingStyle}
Never use these words: ${brand.forbiddenWords?.join(', ') || '(none)'}
Preferred CTAs: ${brand.preferredCTAs?.join(' | ') || '(none)'}
Required disclaimers: ${brand.disclaimers || '(none)'}
`
    : 'BRAND CONTEXT: none — use a neutral, trustworthy seller voice.\n'
}
PRODUCT DATA
${products
  .map(
    (p, i) => `
[Product ${i + 1}]
Name: ${p.name}
Price: ${p.salePrice ? `${p.salePrice} (was ${p.price}) — ON SALE` : p.price}
SKU: ${p.sku}
Categories: ${p.categories.join(', ')}
Key attributes: ${p.attributes.join(' | ') || '(none listed)'}
Description: ${truncate(p.shortDescription || p.description, 400)}
`,
  )
  .join('')}
VIDEO BRIEF
Type: ${VIDEO_TYPE_BRIEFS[config.videoType] ?? VIDEO_TYPE_BRIEFS.review}
Tone: ${config.tone}
Duration: ${config.durationSeconds} seconds (~${config.wordBudget} words)
Target audience: ${audienceLine(config)}
Delivery: ${
  config.voiceScope === 'voiceover'
    ? 'single narrator voiceover'
    : 'full script with visual direction'
}
${promotionBlock(config)}
${config.userPrompt ? `\nEXTRA DIRECTION FROM THE USER\n${config.userPrompt}\n` : ''}
REQUIRED JSON SHAPE
${JSON.stringify(SCRIPT_SCHEMA, null, 2)}
`

// ── D.3 Subtitle chunking (text only — timings computed in JS) ──────────────
export const buildSubtitlePrompt = (voiceovers) => `Split the following voiceover text into subtitle blocks for burned-in captions.

RULES
- Maximum 42 characters per line, maximum 2 lines per block.
- Split at natural clause boundaries. Never split mid-word or mid-number.
- Preserve the original text exactly — do not rewrite, shorten, or translate.
- Return JSON only: { "blocks": [{ "sceneIndex": 0, "text": "..." }] }

TEXT
${voiceovers.map((v, i) => `[Scene ${i}] ${v}`).join('\n')}`

/** Deterministic, free, and correct — no reason to spend a token on timing. */
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

/** WebVTT is the same clock with a dot and an hour field that may be omitted. */
export const vttTime = (s) => srtTime(s).replace(',', '.')

// ── D.4 Single-scene regeneration (cheap — don't regenerate everything) ─────
export const buildSceneRegenPrompt = (script, sceneIndex, instruction) => `Rewrite ONE scene of an existing video script. Keep everything else unchanged.

FULL SCRIPT (for context only — do not rewrite):
${JSON.stringify({
  hook: script.hook,
  cta: script.cta,
  scenes: script.scenes.map((s) => s.title),
})}

SCENE TO REWRITE (index ${sceneIndex}):
${JSON.stringify(script.scenes[sceneIndex], null, 2)}

INSTRUCTION: ${
  instruction || 'Make it stronger and more specific while keeping the same duration and intent.'
}

Return JSON only, the single rewritten scene object with the same keys and the same duration_seconds.`

// ── D.5 AI feedback (not a score) ──────────────────────────────────────────
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

// ── Extras the UI needs, built to the same rules ───────────────────────────

export const buildShotListPrompt = (script) => `Produce a shot list for this video script, for a small crew shooting on a phone or a single camera.

Return JSON only:
{ "shots": [{ "scene": 1, "shot": "1A", "type": "wide|medium|close|macro|over-the-shoulder", "angle": "", "movement": "", "subject": "", "props": "", "location": "", "broll": "", "notes": "" }] }

Keep every shot achievable without a studio. Do not invent props the product data does not mention.

SCRIPT: ${JSON.stringify({ hook: script.hook, scenes: script.scenes, cta: script.cta })}`

export const buildThumbnailPrompt = (script, products) => `Write image-generation prompts for three thumbnail options for this video.

Return JSON only:
{ "thumbnails": [{ "tool": "Midjourney|DALL-E|Stable Diffusion", "prompt": "", "tags": ["", ""], "rationale": "" }] }

RULES
- Each prompt must be a single paragraph of English, usable verbatim in the named tool.
- Describe only what the product data supports. No text overlays containing claims that are not in the data.
- Frame for a 9:16 vertical crop with the subject in the upper two thirds.

PRODUCTS: ${products.map((p) => p.name).join(' | ')}
HOOK: ${script.hook}`

export const buildEnhancePromptPrompt = (userPrompt, config) => `Rewrite the following short creative direction into a sharper brief for a video scriptwriter.

RULES
- Keep it under 60 words. Return the rewritten brief as plain text only — no JSON, no quotes, no preamble.
- Make it concrete and directive: what the hook should do, what emotion to target, how the CTA should close.
- Do not invent product facts, prices, or offers.
- The script will be in ${config.language === 'bn' ? 'Bengali' : config.language === 'banglish' ? 'Banglish' : 'English'} at a ${config.tone} tone.

DIRECTION: ${userPrompt}`
