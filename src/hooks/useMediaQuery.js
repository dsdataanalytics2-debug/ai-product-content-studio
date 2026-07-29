import { useSyncExternalStore } from 'react'

/**
 * useSyncExternalStore rather than useState + useEffect: it reads the correct
 * value during the first render instead of flashing the wrong layout for a
 * frame, which is exactly what you notice on a narrow screen.
 */
export function useMediaQuery(query) {
  const subscribe = (callback) => {
    const mq = window.matchMedia(query)
    mq.addEventListener('change', callback)
    return () => mq.removeEventListener('change', callback)
  }

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false, // SSR fallback; this app is client-only but the arg is required
  )
}

/** Below this, the expanded sidebar leaves too little room to be useful. */
export const useIsNarrow = () => useMediaQuery('(max-width: 900px)')
