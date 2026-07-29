import { create } from 'zustand'
import { MAX_HISTORY, MAX_SELECTED_PRODUCTS, WORDS_PER_SECOND } from '../config/constants'
import { setPath } from '../utils/text'
import { toast } from './useToastStore'

/** The working script. Deliberately NOT persisted — the Library is the store of
 *  record, and a half-generated draft surviving a reload causes more confusion
 *  than it saves. Save moves a draft into useLibraryStore. */

const DEFAULT_CONFIG = {
  videoType: 'review',
  tone: 'professional',
  language: 'bn',
  durationSeconds: 60,
  targetAudience: '',
  voiceScope: 'voiceover',
  brandId: null,
  userPrompt: '',

  // Promotion — how an offer is used, never whether one exists.
  offerType: 'none',
  priceEmphasis: 'mention',
  urgency: 'none',
  occasion: 'none',

  // Customer — structured alongside the free-text targetAudience.
  awareness: 'cold',
  ageRange: '',
  gender: 'any',
  location: '',
  painPoint: '',
}

const initial = {
  selectedProducts: [],
  config: { ...DEFAULT_CONFIG },
  current: null,
  generation: { status: 'idle', provider: null, startedAt: null, error: null },
  history: [],
}

export const useScriptStore = create((set, get) => ({
  ...initial,

  toggleProduct(product) {
    const { selectedProducts } = get()
    const exists = selectedProducts.some((p) => p.id === product.id)

    if (exists) {
      set({ selectedProducts: selectedProducts.filter((p) => p.id !== product.id) })
      return
    }

    // The cap is enforced here rather than in the UI so no screen can bypass it.
    if (selectedProducts.length >= MAX_SELECTED_PRODUCTS) {
      toast.info(
        `${MAX_SELECTED_PRODUCTS} products is the limit`,
        'More than that and the script cannot give any single product enough time to land.',
      )
      return
    }

    set({ selectedProducts: [...selectedProducts, product] })
  },

  clearProducts() {
    set({ selectedProducts: [] })
  },

  /** Shallow merge. */
  setConfig(partial) {
    set((s) => ({ config: { ...s.config, ...partial } }))
  },

  wordBudget() {
    const { language, durationSeconds } = get().config
    return Math.round(durationSeconds * (WORDS_PER_SECOND[language] ?? WORDS_PER_SECOND.en))
  },

  startGeneration(provider) {
    set({
      generation: { status: 'generating', provider, startedAt: Date.now(), error: null },
    })
  },

  finishGeneration(record) {
    set((s) => ({
      current: record,
      history: [s.current, ...s.history].filter(Boolean).slice(0, MAX_HISTORY),
      generation: { status: 'idle', provider: null, startedAt: null, error: null },
    }))
  },

  /** Clears the working draft so the next generation starts a new record. */
  reset() {
    set({
      current: null,
      selectedProducts: [],
      history: [],
      generation: { status: 'idle', provider: null, startedAt: null, error: null },
    })
  },

  failGeneration(appError) {
    set((s) => ({
      generation: { ...s.generation, status: 'error', error: appError, startedAt: null },
    }))
  },

  /** e.g. updateField('script.scenes.0.voiceover', 'নতুন লেখা') */
  updateField(path, value) {
    const { current } = get()
    if (!current) return
    set((s) => ({
      current: { ...setPath(current, path, value), updatedAt: new Date().toISOString() },
      history: [current, ...s.history].slice(0, MAX_HISTORY),
    }))
  },

  /** Replaces one scene wholesale — used by single-scene regeneration. */
  replaceScene(index, scene) {
    const { current } = get()
    if (!current) return
    const scenes = current.script.scenes.map((s, i) => (i === index ? { ...s, ...scene } : s))
    set((s) => ({
      current: {
        ...current,
        script: { ...current.script, scenes },
        updatedAt: new Date().toISOString(),
      },
      history: [current, ...s.history].slice(0, MAX_HISTORY),
    }))
  },

  /** Attaches derived artefacts (feedback, shots, subtitles, thumbnails). */
  attach(name, value) {
    const { current } = get()
    if (!current) return
    set({ current: { ...current, [name]: value, updatedAt: new Date().toISOString() } })
  },

  setStatus(status) {
    const { current } = get()
    if (!current) return
    set({ current: { ...current, status, updatedAt: new Date().toISOString() } })
  },

  load(record) {
    // Loading an existing record also restores the config that produced it, so
    // Regenerate does what the name implies.
    set({
      current: record,
      config: { ...DEFAULT_CONFIG, ...record.config },
      selectedProducts: record.products ?? [],
      history: [],
      generation: { status: 'idle', provider: null, startedAt: null, error: null },
    })
  },

  undo() {
    const { history } = get()
    if (history.length === 0) return false
    const [previous, ...rest] = history
    set({ current: previous, history: rest })
    return true
  },

  canUndo() {
    return get().history.length > 0
  },

  clearAll() {
    set({ ...initial, config: { ...DEFAULT_CONFIG } })
  },
}))
