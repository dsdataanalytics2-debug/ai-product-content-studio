import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { toast } from './useToastStore'

/**
 * Saved directions to the AI.
 *
 * The prompt textarea already persists inside each script's config, so a
 * direction survives on the script it produced — but there was no way to reuse
 * it on the next one, which is where the value is. This is that library.
 *
 * Backup needs no changes: exportBackup sweeps every `acs_`-prefixed key except
 * `acs_api`, so these travel with Export/Restore automatically.
 */

/**
 * Enough to be useful, small enough to stay out of the catalogue's way. At 500
 * characters each this caps around 25 KB against a ~5 MB origin budget the
 * product catalogue already spends ~1.5 MB of. Uncapped, a library of one-off
 * experiments would eventually compete with the thing people actually need.
 */
export const MAX_PROMPTS = 50

const now = () => new Date().toISOString()

/** Same text, ignoring case and surrounding space, is the same prompt. */
const normalise = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase()

export const makePrompt = ({ label, text }) => ({
  id: crypto.randomUUID(),
  label: label.trim() || text.trim().slice(0, 30),
  text: text.trim(),
  createdAt: now(),
  updatedAt: now(),
  lastUsedAt: null,
  useCount: 0,
})

export const usePromptStore = create(
  persist(
    (set, get) => ({
      prompts: [],

      /**
       * Upsert. Saving text that already exists touches the existing entry
       * rather than stacking a duplicate — pressing Save twice on the same
       * direction is a slip, not a request for two copies.
       */
      save({ id, label, text }) {
        const trimmed = text.trim()
        if (!trimmed) return null

        const { prompts } = get()
        const existing =
          (id && prompts.find((p) => p.id === id)) ??
          prompts.find((p) => normalise(p.text) === normalise(trimmed))

        if (existing) {
          const next = {
            ...existing,
            label: (label ?? existing.label).trim() || existing.label,
            text: trimmed,
            updatedAt: now(),
          }
          set({ prompts: prompts.map((p) => (p.id === next.id ? next : p)) })
          return next
        }

        const prompt = makePrompt({ label: label ?? '', text: trimmed })
        let nextList = [prompt, ...prompts]

        if (nextList.length > MAX_PROMPTS) {
          // Evict least recently used, never the one just saved. A prompt never
          // applied has no lastUsedAt, so fall back to when it was created.
          const oldest = [...nextList]
            .slice(1)
            .sort(
              (a, b) =>
                new Date(a.lastUsedAt ?? a.createdAt) - new Date(b.lastUsedAt ?? b.createdAt),
            )[0]
          nextList = nextList.filter((p) => p.id !== oldest.id)
          toast.info('Prompt library full', `Removed the least used one — “${oldest.label}”.`)
        }

        set({ prompts: nextList })
        return prompt
      },

      remove(id) {
        set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) }))
      },

      /** Re-insert a removed prompt in place, for undo. */
      restore(prompt) {
        set((s) => (s.prompts.some((p) => p.id === prompt.id) ? s : { prompts: [prompt, ...s.prompts] }))
      },

      rename(id, label) {
        set((s) => ({
          prompts: s.prompts.map((p) =>
            p.id === id ? { ...p, label: label.trim() || p.label, updatedAt: now() } : p,
          ),
        }))
      },

      /** Records an application, which is what drives the ordering. */
      touch(id) {
        set((s) => ({
          prompts: s.prompts.map((p) =>
            p.id === id ? { ...p, lastUsedAt: now(), useCount: (p.useCount ?? 0) + 1 } : p,
          ),
        }))
      },

      /** Most recently used first; never-used fall back to newest. */
      ordered() {
        return [...get().prompts].sort(
          (a, b) => new Date(b.lastUsedAt ?? b.createdAt) - new Date(a.lastUsedAt ?? a.createdAt),
        )
      },

      clear() {
        set({ prompts: [] })
      },
    }),
    {
      name: 'acs_prompts',
      storage: createJSONStorage(() => createSafeStorage((err) => toast.fromAppError(err))),
    },
  ),
)
