/**
 * Which game is open, remembered across app restarts.
 *
 * Both games save their own progress, but without this the app would always
 * reopen on the menu and people would have to find their way back in.
 */

import { defaultStorage, type StorageLike } from '../state/persistence'

export type ActiveGame = 'menu' | 'poker' | 'undercover'

const STORAGE_KEY = 'game-night.active-game'
const VALID: ReadonlySet<string> = new Set<ActiveGame>(['menu', 'poker', 'undercover'])

export function loadActiveGame(storage: StorageLike | null = defaultStorage()): ActiveGame {
  try {
    const raw = storage?.getItem(STORAGE_KEY)
    return raw && VALID.has(raw) ? (raw as ActiveGame) : 'menu'
  } catch {
    return 'menu'
  }
}

export function saveActiveGame(
  game: ActiveGame,
  storage: StorageLike | null = defaultStorage(),
): void {
  try {
    storage?.setItem(STORAGE_KEY, game)
  } catch {
    // Not worth interrupting anything over.
  }
}
