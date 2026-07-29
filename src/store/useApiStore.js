import { useMemo } from 'react'
import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { PROVIDERS, PROVIDER_ORDER } from '../config/models'
import { toast } from './useToastStore'

/**
 * Keys live in localStorage on this machine. That is Mode A from the plan, and
 * it is a real tradeoff, not an oversight: any script on this origin can read
 * them, so this is for your own machine or a trusted browser profile. The README
 * says so in the setup section, and Settings says so on screen. If you deploy
 * publicly, use Mode B (the Cloudflare Worker in Appendix H) and leave these
 * blank.
 */

const EMPTY_KEYS = {
  // AI providers
  claudeKey: '',
  geminiKey: '',
  groqKey: '',
  openRouterKey: '',
  // Voice
  elevenLabsKey: '',
  googleTtsKey: '',
  // Products source
  storeUrl: '',
  // Bearer token / API key for a private products API. Not needed for
  // WooCommerce's public Store API, which takes no credentials at all.
  storeApiKey: '',
  // Optional WooCommerce REST pair, for SKUs and drafts. Unused by default.
  storeKey: '',
  storeSecret: '',
  // User-defined slot
  customName: '',
  customKey: '',
}

export const useApiStore = create(
  persist(
    (set, get) => ({
      keys: { ...EMPTY_KEYS },
      /** keyName -> { status: 'ok'|'fail'|'testing', message, at } */
      testResults: {},

      setKey(keyName, value) {
        // Trim on write, not on read: a pasted key with a trailing space is the
        // single most common cause of the 401 in Appendix I, and trimming once
        // here means every consumer is safe.
        set((s) => ({ keys: { ...s.keys, [keyName]: (value ?? '').trim() } }))
      },

      clearKey(keyName) {
        set((s) => ({
          keys: { ...s.keys, [keyName]: '' },
          testResults: { ...s.testResults, [keyName]: undefined },
        }))
      },

      setTestResult(keyName, result) {
        set((s) => ({
          testResults: { ...s.testResults, [keyName]: { ...result, at: Date.now() } },
        }))
      },

      clearAllKeys() {
        set({ keys: { ...EMPTY_KEYS }, testResults: {} })
      },

      hasKey(keyName) {
        return Boolean(get().keys[keyName])
      },

      /** Which AI providers are usable right now, in fallback order. */
      /**
       * Derived from PROVIDER_ORDER rather than a second hardcoded list. The old
       * version repeated both the provider ids and their key names, so adding a
       * provider left it saveable in Settings but invisible to generation.
       */
      availableProviders() {
        const { keys } = get()
        return PROVIDER_ORDER.filter((p) => keys[PROVIDERS[p].keyName])
      },

      /**
       * Only the URL is needed now: products come from WooCommerce's public
       * Store API, which takes no credentials. storeKey/storeSecret remain in
       * the key shape for the optional authenticated path (SKUs, drafts), but
       * nothing requires them.
       */
      hasStore() {
        return Boolean(get().keys.storeUrl)
      },
    }),
    {
      name: 'acs_api',
      storage: createJSONStorage(() =>
        createSafeStorage((err) => toast.fromAppError(err)),
      ),
      // testResults are per-session diagnostics; persisting them would show a
      // stale green tick against a key that has since been revoked.
      partialize: (state) => ({ keys: state.keys }),
    },
  ),
)

/**
 * Hook form of availableProviders().
 *
 * Calling the action directly inside a selector — useApiStore(s => s.availableProviders())
 * — returns a NEW array on every render. zustand compares snapshots by
 * reference, so that is an infinite render loop, not a subtle perf issue. Any
 * derived value that is an object or array needs this shape: subscribe to
 * primitives, memoise the derivation.
 */
export function useAvailableProviders() {
  const claude = useApiStore((s) => Boolean(s.keys.claudeKey))
  const gemini = useApiStore((s) => Boolean(s.keys.geminiKey))
  const groq = useApiStore((s) => Boolean(s.keys.groqKey))

  return useMemo(
    () =>
      [
        claude && 'claude',
        gemini && 'gemini',
        groq && 'groq',
      ].filter(Boolean),
    [claude, gemini, groq],
  )
}
