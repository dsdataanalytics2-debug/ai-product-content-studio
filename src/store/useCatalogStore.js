import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { toast } from './useToastStore'

/**
 * The synced product catalogue.
 *
 * Products are imported once and then searched locally, rather than hitting the
 * store on every keystroke. That is the tradeoff this app makes deliberately:
 * search is instant and works offline, at the cost of the catalogue being a
 * snapshot — re-sync after you change prices.
 *
 * `syncing` and `progress` are NOT persisted: a sync interrupted by a reload
 * would otherwise leave a permanent spinner with nothing behind it.
 */
export const useCatalogStore = create(
  persist(
    (set, get) => ({
      products: [],
      lastSyncedAt: null,
      syncedFrom: null, // the store URL these products came from
      /**
       * What customApiService worked out about a non-WooCommerce API: path,
       * auth scheme, where the array lives, which fields map to what. Cached so
       * re-syncs skip the probing, and shown in Settings so a wrong guess is
       * visible rather than silent.
       */
      apiShape: null,
      syncing: false,
      progress: null, // { page, fetched, total }
      error: null,

      startSync(storeUrl) {
        set({ syncing: true, error: null, progress: { page: 1, fetched: 0, total: null }, syncedFrom: storeUrl })
      },

      reportProgress(progress) {
        set({ progress })
      },

      finishSync(products, apiShape) {
        set((s) => ({
          products,
          lastSyncedAt: new Date().toISOString(),
          // Drop the probe sample before persisting — it is a whole raw product
          // object kept only for the UI's "detected" panel, and there is no
          // reason to spend storage on it.
          apiShape: apiShape ? { ...apiShape, sample: undefined } : s.apiShape,
          syncing: false,
          progress: null,
          error: null,
        }))
      },

      failSync(appError) {
        set({ syncing: false, progress: null, error: appError })
      },

      clear() {
        set({
          products: [],
          lastSyncedAt: null,
          syncedFrom: null,
          apiShape: null,
          syncing: false,
          progress: null,
          error: null,
        })
      },

      /**
       * Did the last write actually reach localStorage?
       *
       * zustand's persist write can fail (quota) without the store knowing —
       * in-memory state and disk then disagree, and only a reload reveals it.
       * Reading the count back is the only honest check.
       */
      verifyPersisted() {
        try {
          const raw = localStorage.getItem('acs_catalog')
          if (!raw) return get().products.length === 0
          return JSON.parse(raw)?.state?.products?.length === get().products.length
        } catch {
          return false
        }
      },

      /** Local search over the synced snapshot. */
      search({ q = '', category = '' } = {}) {
        const needle = q.trim().toLowerCase()

        return get().products.filter((p) => {
          if (category && !p.categories.includes(category)) return false
          if (!needle) return true
          return `${p.name} ${p.sku} ${p.categories.join(' ')}`.toLowerCase().includes(needle)
        })
      },

      categories() {
        return [...new Set(get().products.flatMap((p) => p.categories))].sort()
      },
    }),
    {
      name: 'acs_catalog',
      storage: createJSONStorage(() => createSafeStorage((err) => toast.fromAppError(err))),
      // A half-finished sync must not survive a reload.
      partialize: (s) => ({
        products: s.products,
        lastSyncedAt: s.lastSyncedAt,
        syncedFrom: s.syncedFrom,
        apiShape: s.apiShape,
      }),
    },
  ),
)
