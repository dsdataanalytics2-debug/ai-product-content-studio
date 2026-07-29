import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { toast } from './useToastStore'

/**
 * The store of record. Everything the user would be upset to lose lives here,
 * which is why backup/restore (Settings → Data) is not a Phase 3 nicety.
 */
export const useLibraryStore = create(
  persist(
    (set, get) => ({
      records: [],

      /** Upsert by id, sets updatedAt. */
      save(record) {
        const now = new Date().toISOString()
        const existing = get().records.find((r) => r.id === record.id)

        const next = {
          ...record,
          createdAt: existing?.createdAt ?? record.createdAt ?? now,
          updatedAt: now,
        }

        set((s) => ({
          records: existing
            ? s.records.map((r) => (r.id === next.id ? next : r))
            : [next, ...s.records],
        }))

        return next
      },

      remove(id) {
        set((s) => ({ records: s.records.filter((r) => r.id !== id) }))
      },

      duplicate(id) {
        const source = get().records.find((r) => r.id === id)
        if (!source) return null
        const now = new Date().toISOString()
        const copy = {
          ...source,
          id: crypto.randomUUID(),
          title: `${source.title} (copy)`,
          status: 'draft',
          scheduledFor: null,
          createdAt: now,
          updatedAt: now,
        }
        set((s) => ({ records: [copy, ...s.records] }))
        return copy
      },

      get(id) {
        return get().records.find((r) => r.id === id) ?? null
      },

      /** Patch fields on a record without loading it into the editor. */
      patch(id, partial) {
        set((s) => ({
          records: s.records.map((r) =>
            r.id === id ? { ...r, ...partial, updatedAt: new Date().toISOString() } : r,
          ),
        }))
      },

      search({ q = '', status = 'all', language = 'all', assignee = 'all', from, to } = {}) {
        const needle = q.trim().toLowerCase()

        return get().records.filter((r) => {
          if (status !== 'all' && r.status !== status) return false
          if (language !== 'all' && r.config?.language !== language) return false
          if (assignee !== 'all' && r.assignee !== assignee) return false
          if (from && r.createdAt < from) return false
          if (to && r.createdAt > to) return false

          if (!needle) return true
          // Search the script body too — people remember a line from the hook
          // far more often than they remember the title they gave it.
          const haystack = [
            r.title,
            r.script?.hook,
            r.script?.cta,
            ...(r.products ?? []).map((p) => p.name),
            ...(r.script?.scenes ?? []).flatMap((s) => [s.title, s.voiceover]),
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()

          return haystack.includes(needle)
        })
      },

      stats() {
        const records = get().records
        const byStatus = records.reduce((acc, r) => {
          acc[r.status ?? 'draft'] = (acc[r.status ?? 'draft'] ?? 0) + 1
          return acc
        }, {})

        return {
          total: records.length,
          byStatus,
          approved: byStatus.approved ?? 0,
          withVoice: records.filter((r) => r.hasVoice).length,
          scheduled: records.filter((r) => r.scheduledFor).length,
        }
      },

      clear() {
        set({ records: [] })
      },
    }),
    {
      name: 'acs_library',
      storage: createJSONStorage(() => createSafeStorage((err) => toast.fromAppError(err))),
    },
  ),
)

/** Builds a ScriptRecord. One constructor, so every producer agrees on shape. */
export function makeRecord({ script, config, products, provider, model, usage, cost }) {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: script.title,
    status: 'draft',
    script,
    config,
    products,
    provider,
    model,
    usage: usage ?? null,
    cost: cost ?? null,
    feedback: null,
    shots: null,
    subtitles: null,
    thumbnails: null,
    hasVoice: false,
    assignee: null,
    scheduledFor: null,
    comments: [],
    activity: [{ text: 'Script generated', when: now }],
    createdAt: now,
    updatedAt: now,
  }
}
