import { STORAGE_PREFIX } from '../config/constants'
import { AppError } from './errors'

/**
 * localStorage is the whole database. That is a deliberate MVP choice, and it
 * has exactly two failure modes worth engineering for: the quota fills up, and
 * the user clears browsing data. safeSetItem handles the first; backup/restore
 * handles the second.
 */

export const key = (name) => `${STORAGE_PREFIX}${name}`

export function safeSetItem(name, value) {
  try {
    localStorage.setItem(key(name), value)
    return { ok: true }
  } catch (err) {
    // Safari in private mode throws on any write; everywhere else this is quota.
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      err?.code === 22
    return { ok: false, error: new AppError(isQuota ? 'QUOTA_EXCEEDED' : 'UNKNOWN', err.message) }
  }
}

export function safeGetItem(name) {
  try {
    return localStorage.getItem(key(name))
  } catch {
    return null
  }
}

export function removeItem(name) {
  try {
    localStorage.removeItem(key(name))
  } catch {
    /* nothing useful to do */
  }
}

/**
 * Zustand persist storage that reports quota failures instead of swallowing
 * them.
 *
 * NOTE: this does NOT go through safeGetItem/safeSetItem, because those add the
 * `acs_` prefix and every store's persist `name` already carries it. Prefixing
 * here would write `acs_acs_settings` — which reads back as empty forever, so
 * every store silently fails to rehydrate and saved API keys vanish on reload.
 */
export function createSafeStorage(onQuotaError) {
  return {
    getItem: (name) => {
      try {
        return localStorage.getItem(name)
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      try {
        localStorage.setItem(name, value)
      } catch (err) {
        const isQuota =
          err?.name === 'QuotaExceededError' ||
          err?.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
          err?.code === 22
        onQuotaError?.(new AppError(isQuota ? 'QUOTA_EXCEEDED' : 'UNKNOWN', err.message))
      }
    },
    removeItem: (name) => {
      try {
        localStorage.removeItem(name)
      } catch {
        /* nothing useful to do */
      }
    },
  }
}

/** Rough total bytes used by our own keys, for the Settings storage meter. */
export function storageFootprint() {
  let bytes = 0
  let count = 0
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k?.startsWith(STORAGE_PREFIX)) continue
      bytes += k.length + (localStorage.getItem(k)?.length ?? 0)
      count += 1
    }
  } catch {
    return { bytes: 0, count: 0, keys: 0 }
  }
  // UTF-16 code units, so ~2 bytes each.
  return { bytes: bytes * 2, count, keys: count }
}

export const formatBytes = (bytes) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

const BACKUP_VERSION = 1

/**
 * Backup omits API keys on purpose. A backup file is the thing people email
 * themselves and drop in cloud storage; it must not be a credential leak.
 */
export function exportBackup() {
  const data = {}
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (!k?.startsWith(STORAGE_PREFIX)) continue
      if (k === key('api')) continue
      data[k] = localStorage.getItem(k)
    }
  } catch {
    throw new AppError('UNKNOWN', 'Could not read local storage.')
  }

  return {
    _meta: {
      app: 'ai-content-studio',
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      note: 'API keys are intentionally excluded. Re-enter them in Settings after restoring.',
    },
    data,
  }
}

export function importBackup(parsed, { merge = false } = {}) {
  if (parsed?._meta?.app !== 'ai-content-studio' || !parsed?.data)
    throw new AppError('UNKNOWN', 'That file is not an AI Content Studio backup.')

  if (parsed._meta.version > BACKUP_VERSION)
    throw new AppError(
      'UNKNOWN',
      `Backup was made by a newer version (v${parsed._meta.version}). Update the app first.`,
    )

  if (!merge) {
    // Clear our keys only — never touch anything else on the origin.
    const ours = []
    for (let i = 0; i < localStorage.length; i += 1) {
      const k = localStorage.key(i)
      if (k?.startsWith(STORAGE_PREFIX) && k !== key('api')) ours.push(k)
    }
    ours.forEach((k) => localStorage.removeItem(k))
  }

  let restored = 0
  for (const [k, v] of Object.entries(parsed.data)) {
    if (!k.startsWith(STORAGE_PREFIX)) continue
    try {
      localStorage.setItem(k, v)
      restored += 1
    } catch (err) {
      throw new AppError('QUOTA_EXCEEDED', `Restored ${restored} keys, then ran out of space.`, {
        cause: err.message,
      })
    }
  }
  return restored
}

/** Wipe everything of ours, including keys. Used by the Danger Zone. */
export function clearAllAppData() {
  const ours = []
  for (let i = 0; i < localStorage.length; i += 1) {
    const k = localStorage.key(i)
    if (k?.startsWith(STORAGE_PREFIX)) ours.push(k)
  }
  ours.forEach((k) => localStorage.removeItem(k))
  return ours.length
}
