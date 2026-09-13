/**
 * Events.
 *
 * Every change to the game is one of these, appended to a list. State is
 * always recomputed by folding the whole list through the reducer — never
 * mutated in place.
 *
 * Two things fall out of that for free:
 *
 *   Undo      drop the last event, fold again. Cannot drift, cannot half-apply.
 *   History   the record of each hand is already sitting in the log.
 *
 * Events are named in the past tense because they are facts that happened, not
 * requests. They must stay plain JSON — they get written to localStorage.
 */

import { formatMoney, type Money } from './money'
import type { GameConfig, PlayerId } from './types'

// ---------------------------------------------------------------------------

/** A player joining, either at setup or partway through the night. */
export interface SeatedPlayer {
  readonly id: PlayerId
  readonly name: string
  readonly buyIn: Money
}

export type GameEvent =
  // -- Session ------------------------------------------------------------
  | { readonly type: 'GameCreated'; readonly config: GameConfig; readonly players: readonly SeatedPlayer[] }
  | { readonly type: 'SessionEnded' }

  // -- Hand lifecycle -----------------------------------------------------
  /** Starts a hand and collects the boot from everyone dealt in. */
  | { readonly type: 'HandStarted'; readonly dealerId: PlayerId }
  /**
   * Betting is over and the operator has named the winner of each pot.
   *
   * Carries winners, not amounts. The reducer works out the uncalled-bet
   * refund, the pot layers and the split itself, so the arithmetic lives in
   * exactly one place and the UI cannot disagree with it.
   */
  | {
      readonly type: 'PotAwarded'
      /** Lines up with the pot layers: main pot first, then each side pot. */
      readonly winnersByPot: readonly (readonly PlayerId[])[]
      readonly wentToShowdown: boolean
    }
  /** Scrap the hand entirely and give everyone their money back. */
  | { readonly type: 'HandCancelled' }

  // -- Player actions within a hand ---------------------------------------
  | { readonly type: 'Folded'; readonly playerId: PlayerId }
  | { readonly type: 'Checked'; readonly playerId: PlayerId }
  | { readonly type: 'Called'; readonly playerId: PlayerId }
  /**
   * Opening bet. `toAmount` is the total for this round, not the increment.
   *
   * `override` means the table agreed to something the rules would normally
   * refuse — a bet under the minimum, usually. It is recorded on the event so
   * the history shows a hand was played off-book, rather than hiding it.
   */
  | {
      readonly type: 'BetPlaced'
      readonly playerId: PlayerId
      readonly toAmount: Money
      readonly override?: boolean
    }
  /** Re-raise. `toAmount` is again the total for this round. */
  | {
      readonly type: 'Raised'
      readonly playerId: PlayerId
      readonly toAmount: Money
      readonly override?: boolean
    }
  /** Whole stack in. The amount is derived, so it can never disagree. */
  | { readonly type: 'WentAllIn'; readonly playerId: PlayerId }

  // -- Money and roster ---------------------------------------------------
  | { readonly type: 'PlayerAdded'; readonly player: SeatedPlayer }
  | { readonly type: 'ReBought'; readonly playerId: PlayerId; readonly amount: Money }
  | { readonly type: 'SatOut'; readonly playerId: PlayerId }
  | { readonly type: 'SatIn'; readonly playerId: PlayerId }
  /** Leaves the game. Their stack goes back to the bank. */
  | { readonly type: 'CashedOut'; readonly playerId: PlayerId }
  | { readonly type: 'BankToppedUp'; readonly amount: Money }

export type GameEventType = GameEvent['type']

// ---------------------------------------------------------------------------
// Constructors
//
// Thin, but they keep `type` strings out of the call sites, so a typo is a
// compile error instead of an event that silently does nothing.
// ---------------------------------------------------------------------------

export const ev = {
  gameCreated: (config: GameConfig, players: readonly SeatedPlayer[]): GameEvent => ({
    type: 'GameCreated',
    config,
    players,
  }),
  sessionEnded: (): GameEvent => ({ type: 'SessionEnded' }),

  handStarted: (dealerId: PlayerId): GameEvent => ({ type: 'HandStarted', dealerId }),
  potAwarded: (
    winnersByPot: readonly (readonly PlayerId[])[],
    wentToShowdown: boolean,
  ): GameEvent => ({
    type: 'PotAwarded',
    winnersByPot,
    wentToShowdown,
  }),
  handCancelled: (): GameEvent => ({ type: 'HandCancelled' }),

  folded: (playerId: PlayerId): GameEvent => ({ type: 'Folded', playerId }),
  checked: (playerId: PlayerId): GameEvent => ({ type: 'Checked', playerId }),
  called: (playerId: PlayerId): GameEvent => ({ type: 'Called', playerId }),
  bet: (playerId: PlayerId, toAmount: Money, override = false): GameEvent =>
    override
      ? { type: 'BetPlaced', playerId, toAmount, override: true }
      : { type: 'BetPlaced', playerId, toAmount },
  raised: (playerId: PlayerId, toAmount: Money, override = false): GameEvent =>
    override
      ? { type: 'Raised', playerId, toAmount, override: true }
      : { type: 'Raised', playerId, toAmount },
  allIn: (playerId: PlayerId): GameEvent => ({ type: 'WentAllIn', playerId }),

  playerAdded: (player: SeatedPlayer): GameEvent => ({ type: 'PlayerAdded', player }),
  reBought: (playerId: PlayerId, amount: Money): GameEvent => ({ type: 'ReBought', playerId, amount }),
  satOut: (playerId: PlayerId): GameEvent => ({ type: 'SatOut', playerId }),
  satIn: (playerId: PlayerId): GameEvent => ({ type: 'SatIn', playerId }),
  cashedOut: (playerId: PlayerId): GameEvent => ({ type: 'CashedOut', playerId }),
  bankToppedUp: (amount: Money): GameEvent => ({ type: 'BankToppedUp', amount }),
} as const

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const BETTING_ACTIONS = new Set<GameEventType>([
  'Folded',
  'Checked',
  'Called',
  'BetPlaced',
  'Raised',
  'WentAllIn',
])

/** True for the six things a player can do on their turn. */
export function isBettingAction(event: GameEvent): boolean {
  return BETTING_ACTIONS.has(event.type)
}

/**
 * True for events that belong to the hand currently being played.
 *
 * Undo walks back only through these, so it can rewind to the start of the
 * hand and stop there rather than unpicking the whole session.
 */
export function isWithinHand(event: GameEvent): boolean {
  return isBettingAction(event) || event.type === 'HandStarted'
}

/** Who acted, for the six in-hand actions. Null for everything else. */
export function actingPlayerId(event: GameEvent): PlayerId | null {
  switch (event.type) {
    case 'Folded':
    case 'Checked':
    case 'Called':
    case 'BetPlaced':
    case 'Raised':
    case 'WentAllIn':
      return event.playerId
    default:
      return null
  }
}

/**
 * Past tense, for telling the operator what just happened.
 *
 * Without this there is no confirmation that a tap landed on the player you
 * meant — you press Check four times and never find out whose check it was.
 */
export function describeActionTaken(event: GameEvent): string | null {
  switch (event.type) {
    case 'Folded':
      return 'folded'
    case 'Checked':
      return 'checked'
    case 'Called':
      return 'called'
    case 'BetPlaced':
      return `bet ${formatMoney(event.toAmount)}`
    case 'Raised':
      return `raised to ${formatMoney(event.toAmount)}`
    case 'WentAllIn':
      return 'went all-in'
    default:
      return null
  }
}

/**
 * A short label for the undo button and the history list.
 * Amounts are appended by the caller, which has the formatter.
 */
export function describeEvent(event: GameEvent): string {
  switch (event.type) {
    case 'GameCreated':
      return 'Game created'
    case 'SessionEnded':
      return 'Session ended'
    case 'HandStarted':
      return 'Hand started'
    case 'PotAwarded':
      return 'Pot awarded'
    case 'HandCancelled':
      return 'Hand cancelled'
    case 'Folded':
      return 'Fold'
    case 'Checked':
      return 'Check'
    case 'Called':
      return 'Call'
    case 'BetPlaced':
      return 'Bet'
    case 'Raised':
      return 'Raise'
    case 'WentAllIn':
      return 'All-in'
    case 'PlayerAdded':
      return 'Player added'
    case 'ReBought':
      return 'Re-buy'
    case 'SatOut':
      return 'Sat out'
    case 'SatIn':
      return 'Sat back in'
    case 'CashedOut':
      return 'Cashed out'
    case 'BankToppedUp':
      return 'Bank topped up'
  }
}
