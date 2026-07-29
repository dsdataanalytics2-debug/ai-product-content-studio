import { create } from 'zustand'

let nextId = 1

/**
 * Deliberately not persisted. A toast that survives a reload is a bug.
 */
export const useToastStore = create((set, get) => ({
  toasts: [],

  push({ tone = 'info', title, body, action, timeout = 4500 }) {
    const id = nextId++
    set((s) => ({ toasts: [...s.toasts, { id, tone, title, body, action }] }))
    if (timeout) setTimeout(() => get().dismiss(id), timeout)
    return id
  },

  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },

  clear() {
    set({ toasts: [] })
  },
}))

// Shorthands, so call sites read as one line.
export const toast = {
  success: (title, body) => useToastStore.getState().push({ tone: 'success', title, body }),
  error: (title, body, action) =>
    useToastStore.getState().push({ tone: 'danger', title, body, action, timeout: 8000 }),
  info: (title, body, action) => useToastStore.getState().push({ tone: 'info', title, body, action }),

  /** Renders an AppError using its ERROR_MESSAGES entry (Appendix E). */
  fromAppError: (appError) => {
    const { title, body, action } = appError.display()
    return useToastStore.getState().push({ tone: 'danger', title, body, action, timeout: 9000 })
  },
}
