/**
 * Saving an Undercover game.
 *
 * Installed as an app on a phone, the game gets killed whenever the OS wants
 * the memory back — somebody checks a message mid-vote and the round is gone.
 * This keeps the current state (and its undo history) in localStorage so the
 * app reopens where it was.
 *
 * Leaving the game on purpose clears it, exactly as before; this only covers
 * the app being closed underneath you.
 */

import { defaultStorage, type StorageLike } from '../state/persistence'
import type { GamePhase, UcGameState } from './engine/types'

const STORAGE_KEY = 'undercover.session'
export const UC_SCHEMA_VERSION = 1

interface StoredUcSession {
  readonly version: number
  readonly state: UcGameState
  readonly history: readonly UcGameState[]
}

export interface UcSession {
  readonly state: UcGameState
  readonly history: readonly UcGameState[]
}

const PHASES: ReadonlySet<GamePhase['phase']> = new Set([
  'setup',
  'wordReveal',
  'description',
  'voting',
  'elimination',
  'mrWhiteGuess',
  'gameOver',
  'finalResults',
])

/** Enough of a shape check to refuse anything corrupt or from another version. */
function looksLikeState(value: unknown): value is UcGameState {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  const phase = (s.phaseState as { phase?: unknown } | undefined)?.phase
  return (
    Array.isArray(s.players) &&
    Array.isArray(s.roundPlayers) &&
    Array.isArray(s.turnOrder) &&
    Array.isArray(s.scores) &&
    Array.isArray(s.usedWordIndices) &&
    typeof s.roundNumber === 'number' &&
    typeof s.roleConfig === 'object' &&
    s.roleConfig !== null &&
    typeof s.scoringConfig === 'object' &&
    s.scoringConfig !== null &&
    typeof phase === 'string' &&
    PHASES.has(phase as GamePhase['phase'])
  )
}

/**
 * A word that was on screen when the app closed must not be on screen when it
 * reopens — whoever picks the phone up next might not be the player it was for.
 */
function hideRevealedWord(state: UcGameState): UcGameState {
  return state.phaseState.phase === 'wordReveal' && state.phaseState.revealed
    ? { ...state, phaseState: { ...state.phaseState, revealed: false } }
    : state
}

export function saveUcSession(
  session: UcSession,
  storage: StorageLike | null = defaultStorage(),
): void {
  if (!storage) return

  // A blank setup screen is not worth keeping.
  if (session.state.phaseState.phase === 'setup' && session.state.scores.length === 0) {
    clearUcSession(storage)
    return
  }

  const payload: StoredUcSession = {
    version: UC_SCHEMA_VERSION,
    state: session.state,
    history: session.history,
  }
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(payload))
  } catch {
    // Quota or revoked storage — losing the backup must not interrupt the game.
  }
}

export function loadUcSession(storage: StorageLike | null = defaultStorage()): UcSession | null {
  if (!storage) return null

  let raw: string | null
  try {
    raw = storage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredUcSession>
    if (parsed.version !== UC_SCHEMA_VERSION) return null
    if (!looksLikeState(parsed.state)) return null
    const history = Array.isArray(parsed.history) ? parsed.history.filter(looksLikeState) : []
    return {
      state: hideRevealedWord(parsed.state),
      history: history.map(hideRevealedWord),
    }
  } catch {
    return null
  }
}

export function clearUcSession(storage: StorageLike | null = defaultStorage()): void {
  if (!storage) return
  try {
    storage.removeItem(STORAGE_KEY)
  } catch {
    // Nothing useful to do.
  }
}
