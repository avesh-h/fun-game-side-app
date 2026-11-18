/**
 * Saving the night.
 *
 * This is not a database and nothing leaves the phone. It exists for one
 * reason: a stray refresh, a locked screen or a closed tab should not wipe out
 * two hours of poker.
 *
 * What gets stored is the *event log*, not the state. Events are the source of
 * truth — state is only ever derived from them — so storing them is smaller,
 * survives changes to how state is shaped, and means a reload is just a replay.
 */

import type { GameEvent } from '../engine/events'
import { replay } from '../engine/reducer'

const STORAGE_KEY = 'poker-ledger.session'
export const SCHEMA_VERSION = 1

interface StoredSession {
  readonly version: number
  readonly savedAt: string
  readonly events: readonly GameEvent[]
}

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

/**
 * localStorage, but only if it actually works.
 *
 * Private browsing modes expose the API and then throw the moment you write to
 * it, so this proves a write succeeds before trusting it. When storage is
 * unavailable the app still runs perfectly — it just will not survive a reload.
 */
export function defaultStorage(): StorageLike | null {
  try {
    if (typeof localStorage === 'undefined') return null
    const probe = '__poker_ledger_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

export function isStorageAvailable(storage: StorageLike | null = defaultStorage()): boolean {
  return storage !== null
}

export function saveSession(
  events: readonly GameEvent[],
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return

  if (events.length === 0) {
    clearSession(storage)
    return
  }

  const payload: StoredSession = {
    version: SCHEMA_VERSION,
    savedAt: new Date().toISOString(),
    events,
  }

  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota exceeded, or storage revoked mid-session. Losing the backup is bad
    // but it must never interrupt a hand in progress.
  }
}

/**
 * Read back a saved session, or null if there is nothing usable.
 *
 * The events are replayed before being handed over. If they do not produce a
 * valid game — corrupted, hand-edited, written by an incompatible version —
 * null comes back and the app starts fresh rather than booting into a broken
 * ledger.
 */
export function loadSession(
  storage: StorageLike | null = defaultStorage(),
): readonly GameEvent[] | null {
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredSession>

    if (parsed.version !== SCHEMA_VERSION) return null
    if (!Array.isArray(parsed.events) || parsed.events.length === 0) return null

    // Prove it rebuilds into a real game before trusting it.
    replay(parsed.events)

    return parsed.events
  } catch {
    return null
  }
}

export function clearSession(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing useful to do.
  }
}

const TOUR_KEY = 'poker-ledger.walkthrough-seen'

/** Whether the walkthrough has already been shown once on this device. */
export function hasSeenWalkthrough(storage: StorageLike | null = defaultStorage()): boolean {
  if (!storage) return true // Cannot remember, so do not nag on every reload.
  try {
    return storage.getItem(TOUR_KEY) === '1'
  } catch {
    return true
  }
}

export function markWalkthroughSeen(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.setItem(TOUR_KEY, '1')
  } catch {
    // Not worth interrupting anything over.
  }
}

/** In-memory stand-in, used by the tests. */
export function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>()
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => void map.set(key, value),
    removeItem: (key) => void map.delete(key),
  }
}
