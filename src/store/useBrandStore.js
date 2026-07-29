import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { toast } from './useToastStore'

/**
 * Brand Memory. Listed as Phase 2 in the plan, built now because it is the one
 * thing that makes the tenth script sound like the first — and because the
 * prompt already takes a brand block, so leaving it as a placeholder would mean
 * shipping a prompt path nothing exercises.
 */

export const makeBrand = (partial = {}) => ({
  id: crypto.randomUUID(),
  name: 'New brand',
  industry: 'Skincare & Beauty',
  emoji: '✨',
  colors: ['#9333EA', '#EC4899'],
  tone: '',
  writingStyle: 'Casual',
  traits: [],
  forbiddenWords: [],
  preferredCTAs: [],
  disclaimers: '',
  createdAt: new Date().toISOString(),
  ...partial,
})

export const useBrandStore = create(
  persist(
    (set, get) => ({
      brands: [],
      activeBrandId: null,

      create(partial) {
        const brand = makeBrand(partial)
        set((s) => ({
          brands: [...s.brands, brand],
          // First brand becomes active automatically — otherwise a user creates
          // one, generates, and silently gets no brand voice.
          activeBrandId: s.activeBrandId ?? brand.id,
        }))
        return brand
      },

      update(id, partial) {
        set((s) => ({
          brands: s.brands.map((b) => (b.id === id ? { ...b, ...partial } : b)),
        }))
      },

      remove(id) {
        set((s) => ({
          brands: s.brands.filter((b) => b.id !== id),
          activeBrandId: s.activeBrandId === id ? null : s.activeBrandId,
        }))
      },

      setActive(id) {
        set({ activeBrandId: id })
      },

      get(id) {
        return get().brands.find((b) => b.id === id) ?? null
      },

      active() {
        const { brands, activeBrandId } = get()
        return brands.find((b) => b.id === activeBrandId) ?? null
      },

      /** Adds a value to one of the tag-style arrays, de-duplicated. */
      addTo(id, field, value) {
        const clean = value.trim()
        if (!clean) return
        set((s) => ({
          brands: s.brands.map((b) =>
            b.id === id && !b[field].includes(clean)
              ? { ...b, [field]: [...b[field], clean] }
              : b,
          ),
        }))
      },

      removeFrom(id, field, value) {
        set((s) => ({
          brands: s.brands.map((b) =>
            b.id === id ? { ...b, [field]: b[field].filter((v) => v !== value) } : b,
          ),
        }))
      },
    }),
    {
      name: 'acs_brands',
      storage: createJSONStorage(() => createSafeStorage((err) => toast.fromAppError(err))),
    },
  ),
)
