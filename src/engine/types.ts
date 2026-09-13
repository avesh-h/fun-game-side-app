/**
 * The domain model.
 *
 * Everything here is immutable and plain data. No classes, no methods, no
 * React. The whole state of a poker night is one `GameState` object, and it is
 * only ever produced by folding events through the reducer.
 */

import { add, type Money } from './money'

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

declare const PlayerIdBrand: unique symbol

/** Stable id for a player, independent of their name (names can repeat). */
export type PlayerId = string & { readonly [PlayerIdBrand]: true }

export function playerId(raw: string): PlayerId {
  return raw as PlayerId
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export type PlayerStatus =
  /** Seated and will be dealt into the next hand. */
  | 'active'
  /** Seated but skipping hands — stepped away, eating, whatever. */
  | 'sittingOut'
  /** Cashed out. Stack returned to the bank. Kept for the settlement report. */
  | 'left'

export interface Player {
  readonly id: PlayerId
  readonly name: string
  /** Money in front of them right now. Never negative. */
  readonly stack: Money
  readonly status: PlayerStatus
  /**
   * Every rupee this player has ever taken out of the bank, across the whole
   * session. This is the denominator of "are they up or down" at settlement.
   */
  readonly totalTakenFromBank: Money
  /**
   * Chips handed back to the bank — which only happens when someone cashes out
   * and leaves.
   *
   * Without this, a player who took 1,000 and walked away with 2,000 would show
   * as down 1,000 at the end, because cashing out empties their stack. What
   * they finished with is `stack + totalReturnedToBank`.
   */
  readonly totalReturnedToBank: Money
  /** Seating position. Fixed on join, decides clockwise order. */
  readonly seat: number
}

// ---------------------------------------------------------------------------
// A hand in progress
// ---------------------------------------------------------------------------

export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river'

export const BETTING_ROUNDS = ['preflop', 'flop', 'turn', 'river'] as const

/** Plain-English labels for the UI. The app never sees the cards themselves. */
export const ROUND_LABELS: Readonly<Record<BettingRound, string>> = {
  preflop: 'Pre-flop',
  flop: 'Flop',
  turn: 'Turn',
  river: 'River',
}

export type HandPlayerStatus =
  /** Still contesting the pot and still has chips behind. */
  | 'in'
  /** Threw the hand away. Money already in stays in the pot. */
  | 'folded'
  /** Everything is in the middle. Cannot act again this hand. */
  | 'allIn'

export interface HandPlayer {
  readonly playerId: PlayerId
  readonly status: HandPlayerStatus
  /** Put in during the current betting round only. Resets each round. */
  readonly committedThisRound: Money
  /**
   * Put in across the entire hand, boot included. This is the single input to
   * side-pot construction, so it must never be reset mid-hand.
   */
  readonly committedTotal: Money
  /**
   * Whether they have had their turn since the last full raise.
   *
   * This one flag carries the trickiest rule in No Limit: a full raise clears
   * it for everyone else (they get to act again), while an all-in for less
   * than a full raise does not. A player who still owes money but has already
   * acted may therefore only call or fold — they cannot re-raise.
   */
  readonly hasActedThisRound: boolean
}

export type HandPhase =
  /** Players are acting. */
  | 'betting'
  /** Betting is done; the operator must say who won. */
  | 'awaitingWinner'
  /** Pots awarded. Ready to deal the next hand. */
  | 'complete'

export interface Hand {
  readonly number: number
  readonly dealerId: PlayerId
  /** What each player paid in to start this hand. Frozen at hand start. */
  readonly boot: Money
  /** Table charge each player paid this hand. Went to the bank, not the pot. */
  readonly rake: Money
  /** Smallest legal opening bet. Frozen at hand start alongside the boot. */
  readonly minBet: Money
  readonly round: BettingRound
  readonly phase: HandPhase
  /** Only players dealt into this hand, in clockwise seat order. */
  readonly players: readonly HandPlayer[]
  /** Whose turn it is. Null when nobody can act (betting finished). */
  readonly toActId: PlayerId | null
  /** Highest amount anyone has committed in the current round. */
  readonly currentBet: Money
  /**
   * Size of the last full raise. Sets the floor for the next legal raise:
   * a re-raise must add at least this much again.
   */
  readonly lastRaiseSize: Money
}

// ---------------------------------------------------------------------------
// Completed hands — the record the notebook used to hold
// ---------------------------------------------------------------------------

export interface Contribution {
  readonly playerId: PlayerId
  readonly amount: Money
}

export interface Award {
  readonly playerId: PlayerId
  readonly amount: Money
}

export interface HandRecord {
  readonly number: number
  readonly boot: Money
  readonly dealerId: PlayerId
  /** What every player put in, whether they folded or not. */
  readonly contributions: readonly Contribution[]
  readonly totalPot: Money
  /** Table charge collected this hand, across everyone dealt in. */
  readonly raked: Money
  readonly awards: readonly Award[]
  /** How far the hand got before it ended. */
  readonly endedAtRound: BettingRound
  /** False when everyone folded and no cards needed showing. */
  readonly wentToShowdown: boolean
}

// ---------------------------------------------------------------------------
// Configuration and the whole game
// ---------------------------------------------------------------------------

export interface GameConfig {
  /** Money the bank starts with. The only place money is ever created. */
  readonly initialBank: Money
  /** What every player pays into the pot at the start of each hand. */
  readonly boot: Money
  /**
   * Table charge — an extra amount every player pays each hand that goes
   * straight back to the bank rather than into the pot. Sometimes called a
   * rake. Zero means no charge, which is the normal case for a friendly game.
   */
  readonly rake: Money
  /** Smallest legal opening bet. Defaults to the boot. */
  readonly minBet: Money
  /** Pre-filled amount on the re-buy screen. Not a limit. */
  readonly defaultBuyIn: Money
}

export type GamePhase = 'setup' | 'playing' | 'ended'

export interface GameState {
  readonly config: GameConfig
  readonly phase: GamePhase
  /** What is left in the bank for people to borrow. */
  readonly bank: Money
  /** Everyone who has ever sat down, including those who left. */
  readonly players: readonly Player[]
  /** The hand being played, or null between hands. */
  readonly hand: Hand | null
  readonly history: readonly HandRecord[]
  /** Dealer of the previous hand, so the marker can move on. */
  readonly lastDealerId: PlayerId | null
  /**
   * Total money issued by the bank over the session. Starts equal to
   * `config.initialBank` and only changes if the bank is topped up. This is
   * the constant the money invariant checks against.
   */
  readonly totalIssued: Money
  /**
   * Everything the table charge has taken off the players across the session.
   * It is sitting in the bank, so no money is lost — but it is the reason the
   * players' wins and losses no longer come to zero on their own.
   */
  readonly totalRaked: Money
}

// ---------------------------------------------------------------------------
// Derived helpers used all over the engine and UI
// ---------------------------------------------------------------------------

export function findPlayer(state: GameState, id: PlayerId): Player | undefined {
  return state.players.find((p) => p.id === id)
}

export function findHandPlayer(hand: Hand, id: PlayerId): HandPlayer | undefined {
  return hand.players.find((p) => p.playerId === id)
}

/** What it costs a player to be dealt in: the boot plus any table charge. */
export function entryCost(config: GameConfig): Money {
  return add(config.boot, config.rake)
}

/**
 * Players who can be dealt into the next hand.
 *
 * Anyone who cannot cover the full entry is held back rather than dealt in
 * short, so the operator is asked whether they want to borrow or sit out
 * instead of it happening silently.
 */
export function dealablePlayers(state: GameState): readonly Player[] {
  const cost = entryCost(state.config)
  return state.players.filter((p) => p.status === 'active' && p.stack >= cost)
}

/** Still at the table, still willing, but short of the entry cost. */
export function playersShortOfEntry(state: GameState): readonly Player[] {
  const cost = entryCost(state.config)
  return state.players.filter((p) => p.status === 'active' && p.stack < cost)
}

/** Players still contesting the pot — not folded. Includes all-ins. */
export function contestingPlayers(hand: Hand): readonly HandPlayer[] {
  return hand.players.filter((p) => p.status !== 'folded')
}

/** Players who can still put more money in. Excludes folded and all-in. */
export function actablePlayers(hand: Hand): readonly HandPlayer[] {
  return hand.players.filter((p) => p.status === 'in')
}
