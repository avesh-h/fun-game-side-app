/**
 * The store.
 *
 * Holds the event log and nothing else. State is recomputed from it on every
 * change, which sounds wasteful and is not: a long poker night is a few
 * thousand tiny events, and replaying them costs well under a millisecond.
 *
 * What it buys is worth far more than those microseconds — state and log can
 * never disagree, and undo is just "replay one event fewer".
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { describeEvent, isWithinHand, type GameEvent } from '../engine/events'
import { checkMoney, type InvariantReport } from '../engine/invariants'
import { EMPTY_STATE, reduce, replay } from '../engine/reducer'
import type { GameState } from '../engine/types'
import { clearSession, isStorageAvailable, loadSession, saveSession } from './persistence'

export interface Store {
  readonly state: GameState
  readonly events: readonly GameEvent[]
  readonly invariant: InvariantReport

  readonly canUndo: boolean
  /** What the undo button will take back, e.g. "Call". */
  readonly undoLabel: string | null
  /** How many taps of undo stay inside the hand being played. */
  readonly undoStepsInHand: number

  /** The last action that was refused, and why. Null when nothing is wrong. */
  readonly lastError: string | null
  /** True when the session cannot be saved — private browsing, usually. */
  readonly storageUnavailable: boolean

  /** True when there is a hand to rewind past. */
  readonly canScrapLastHand: boolean

  dispatch(event: GameEvent): void
  undo(): void
  /**
   * Rewind to just before the most recent hand was dealt.
   *
   * Only the *last* hand can go. Undoing an earlier one would be incoherent —
   * every hand since was played against stacks that hand produced, so removing
   * it would leave the rest of the night resting on numbers that never existed.
   */
  scrapLastHand(): void
  newGame(): void
  dismissError(): void
}

/** Exported for tests — where the most recent hand begins in the log. */
export function lastHandStartIndex(events: readonly GameEvent[]): number {
  for (let i = events.length - 1; i >= 0; i -= 1) {
    if (events[i]?.type === 'HandStarted') return i
  }
  return -1
}

export function useCreateStore(): Store {
  const [events, setEvents] = useState<readonly GameEvent[]>(() => loadSession() ?? [])
  const [lastError, setLastError] = useState<string | null>(null)
  const [storageUnavailable] = useState(() => !isStorageAvailable())

  // State is always derived. The catch is belt-and-braces: every event is
  // validated before it is stored, so this should never fire — but a crash
  // mid-hand would be far worse than a message.
  const { state, replayError } = useMemo(() => {
    try {
      return { state: replay(events), replayError: null as string | null }
    } catch (error) {
      return {
        state: EMPTY_STATE,
        replayError: error instanceof Error ? error.message : String(error),
      }
    }
  }, [events])

  useEffect(() => {
    saveSession(events)
  }, [events])

  const dispatch = useCallback(
    (event: GameEvent) => {
      try {
        // Run it first. If the rules refuse, nothing is recorded.
        reduce(state, event)
        setLastError(null)
        setEvents((previous) => [...previous, event])
      } catch (error) {
        setLastError(error instanceof Error ? error.message : String(error))
      }
    },
    [state],
  )

  const undo = useCallback(() => {
    setLastError(null)
    // The opening event is kept — undoing it would leave no game at all.
    setEvents((previous) => (previous.length > 1 ? previous.slice(0, -1) : previous))
  }, [])

  const scrapLastHand = useCallback(() => {
    setLastError(null)
    setEvents((previous) => {
      const start = lastHandStartIndex(previous)
      return start === -1 ? previous : previous.slice(0, start)
    })
  }, [])

  const newGame = useCallback(() => {
    setLastError(null)
    setEvents([])
    clearSession()
  }, [])

  const dismissError = useCallback(() => setLastError(null), [])

  const invariant = useMemo(() => checkMoney(state), [state])

  const undoStepsInHand = useMemo(() => {
    let steps = 0
    for (let i = events.length - 1; i >= 0; i -= 1) {
      const event = events[i]
      if (!event || !isWithinHand(event)) break
      steps += 1
      if (event.type === 'HandStarted') break
    }
    return steps
  }, [events])

  const last = events[events.length - 1]

  return {
    state,
    events,
    invariant,
    canUndo: events.length > 1,
    undoLabel: events.length > 1 && last ? describeEvent(last) : null,
    undoStepsInHand,
    lastError: lastError ?? replayError,
    storageUnavailable,
    canScrapLastHand: lastHandStartIndex(events) !== -1,
    dispatch,
    undo,
    scrapLastHand,
    newGame,
    dismissError,
  }
}
