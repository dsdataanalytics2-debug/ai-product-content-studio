import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { createSafeStorage } from '../utils/storage'
import { toast } from './useToastStore'
import { defaultModelFor } from '../config/models'
import { FONT_SCALES } from '../config/constants'

/**
 * Appendix I: "Instrument early." The DEBUG flag and its rolling log are the
 * highest-leverage thing in this file — when a generation comes back malformed,
 * the question is always "what did we actually send", and without this you are
 * guessing.
 */
const DEBUG_LOG_LIMIT = 40
let debugLog = [] // module-scope, not state: it must not be persisted or re-render anything

export const debug = {
  record(entry) {
    if (!useSettingsStore.getState().debugMode) return
    debugLog = [{ at: new Date().toISOString(), ...entry }, ...debugLog].slice(0, DEBUG_LOG_LIMIT)
  },
  all: () => debugLog,
  clear() {
    debugLog = []
  },
  asText() {
    if (debugLog.length === 0) return 'Debug log is empty. Enable Debug mode, then generate.'
    return debugLog
      .map((e) =>
        [
          `── ${e.at} · ${e.provider ?? '?'} · ${e.model ?? '?'} · ${e.kind ?? 'request'}`,
          e.ms != null ? `elapsed: ${e.ms}ms` : null,
          e.usage ? `usage: ${JSON.stringify(e.usage)}` : null,
          e.error ? `error: ${e.error}` : null,
          e.system ? `--- system ---\n${e.system}` : null,
          e.prompt ? `--- prompt ---\n${e.prompt}` : null,
          e.raw ? `--- raw response ---\n${e.raw}` : null,
        ]
          .filter(Boolean)
          .join('\n'),
      )
      .join('\n\n')
  },
}

export const useSettingsStore = create(
  persist(
    (set, get) => ({
      // ── Appearance ──
      theme: 'dark', // 'dark' | 'light' | 'system'
      accent: '#8B5CF6',
      fontScale: 'medium',
      sidebarMode: 'expanded', // 'expanded' | 'collapsed'
      uiLanguage: 'english',

      // ── AI ──
      preferredProvider: 'claude',
      model: defaultModelFor('claude'),
      /** Try the next configured provider when the preferred one fails. */
      autoFallback: true,
      effort: 'high', // Claude only: low | medium | high | xhigh | max

      // ── Voice ──
      voiceProvider: 'browser',
      voiceId: '',
      speed: 1,
      pitch: 0,
      volume: 80,

      // ── Notifications (local only — there is no server to send from) ──
      notifications: {
        generated: true,
        apiErrors: true,
        calendar: true,
        weekly: false,
      },

      // ── Diagnostics ──
      debugMode: false,

      // ── Profile ──
      profileName: 'You',
      avatarUrl: null,

      set(partial) {
        set(partial)
      },

      setNotification(name, value) {
        set((s) => ({ notifications: { ...s.notifications, [name]: value } }))
      },

      setProvider(provider) {
        set({ preferredProvider: provider, model: defaultModelFor(provider) })
      },

      toggleDebug() {
        const next = !get().debugMode
        set({ debugMode: next })
        if (!next) debug.clear()
      },

      resetAppearance() {
        set({
          theme: 'dark',
          accent: '#8B5CF6',
          fontScale: 'medium',
          sidebarMode: 'expanded',
          uiLanguage: 'english',
        })
      },
    }),
    {
      name: 'acs_settings',
      storage: createJSONStorage(() => createSafeStorage((err) => toast.fromAppError(err))),
    },
  ),
)

/**
 * Applies theme/accent/font-scale to the document. Called once on mount and on
 * every change — the DOM is the single source of truth for what's rendered, so
 * there is no second copy of these values in CSS to drift.
 */
export function applyAppearance(settings) {
  const root = document.documentElement

  const resolved =
    settings.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: light)').matches
        ? 'light'
        : 'dark'
      : settings.theme

  root.dataset.theme = resolved
  root.style.setProperty('--color-accent', settings.accent)
  root.style.setProperty(
    '--font-scale',
    String(FONT_SCALES.find((f) => f.value === settings.fontScale)?.scale ?? 1),
  )
}
