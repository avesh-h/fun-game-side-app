/**
 * The betting rules.
 *
 * Pure functions over a `Hand`. They decide what a player is allowed to do,
 * what happens when they do it, and when a round of betting is finished.
 *
 * The rule worth reading twice is in `applyAggression`: a raise big enough to
 * count as a real raise gives everyone else their turn back, but an all-in for
 * less than that does not. Someone who has already acted and is facing only a
 * short all-in may call or fold, and nothing else. That is the rule home games
 * argue about most, and it lives in one `if`.
 */

import { add, deduct, isPositive, isZero, max, min, money, sub, ZERO, type Money } from './money'
import { clockwiseFromDealer, firstToActId, nextToActId } from './seating'
import {
  BETTING_ROUNDS,
  dealablePlayers,
  type GameState,
  type Hand,
  type HandPlayer,
  type Player,
  type PlayerId,
} from './types'

export class RuleError extends Error {
  override name = 'RuleError'
}

function requireHandPlayer(hand: Hand, id: PlayerId): HandPlayer {
  const player = hand.players.find((p) => p.playerId === id)
  if (!player) throw new RuleError(`Player ${id} is not in this hand`)
  return player
}

// ---------------------------------------------------------------------------
// Starting a hand
// ---------------------------------------------------------------------------

/** What one player paid to be dealt in: boot to the pot, rake to the bank. */
export interface EntryCharge {
  readonly playerId: PlayerId
  readonly boot: Money
  readonly rake: Money
}

export interface HandStart {
  readonly hand: Hand
  readonly charged: readonly EntryCharge[]
}

/**
 * Deal everyone in, collect the boot into the pot and the table charge into
 * the bank.
 *
 * Only players who can cover the whole entry are dealt in — anyone short is
 * held back so the operator can decide whether they borrow or sit out. That is
 * a house rule rather than casino practice, chosen so nobody is quietly put
 * all-in before they have seen a card.
 *
 * The boot is dead money rather than a bet to match, so betting opens at zero
 * and the first player may check. That is the difference between a boot and a
 * big blind.
 */
export function startHand(state: GameState, dealerId: PlayerId): HandStart {
  const seated = [...dealablePlayers(state)].sort((a, b) => a.seat - b.seat)
  if (seated.length < 2) {
    throw new RuleError('Need at least two players who can cover the entry to start a hand')
  }
  if (!seated.some((p) => p.id === dealerId)) {
    throw new RuleError('The dealer must be one of the players in the hand')
  }

  const { boot, minBet, rake } = state.config
  const charged: EntryCharge[] = []

  const players: HandPlayer[] = seated.map((player: Player) => {
    charged.push({ playerId: player.id, boot, rake })
    const left = deduct(deduct(player.stack, rake, 'stack'), boot, 'stack')
    return {
      playerId: player.id,
      // Paying the entry with the very last of a stack leaves that player
      // all-in before a single bet is made.
      status: isZero(left) ? 'allIn' : 'in',
      committedThisRound: ZERO,
      committedTotal: boot,
      hasActedThisRound: false,
    }
  })

  const base: Hand = {
    number: state.history.length + 1,
    dealerId,
    boot,
    rake,
    minBet,
    round: 'preflop',
    phase: 'betting',
    players,
    toActId: null,
    currentBet: ZERO,
    lastRaiseSize: minBet,
  }

  // If at most one player can still put chips in, there is nothing to bet
  // about — go straight to naming a winner.
  const canAct = players.filter((p) => p.status === 'in')
  if (canAct.length <= 1) {
    return { hand: { ...base, phase: 'awaitingWinner' }, charged }
  }

  return { hand: { ...base, toActId: firstToActId(base) }, charged }
}

// ---------------------------------------------------------------------------
// What is allowed right now
// ---------------------------------------------------------------------------

export interface LegalActions {
  readonly playerId: PlayerId
  readonly canFold: boolean
  readonly canCheck: boolean
  readonly canCall: boolean
  /** Extra chips needed to call, already capped at what they actually have. */
  readonly callAmount: Money
  readonly callIsAllIn: boolean
  /** Opening bet, only when nobody has bet yet this round. */
  readonly canBet: boolean
  readonly canRaise: boolean
  readonly minRaiseTo: Money
  readonly maxRaiseTo: Money
  readonly canAllIn: boolean
  readonly allInTo: Money
  /** Why raising is unavailable, in words the UI can show. */
  readonly raiseBlockedReason: string | null
}

export function legalActions(state: GameState): LegalActions | null {
  const hand = state.hand
  if (!hand || hand.phase !== 'betting' || !hand.toActId) return null

  const handPlayer = requireHandPlayer(hand, hand.toActId)
  const player = state.players.find((p) => p.id === hand.toActId)
  if (!player || handPlayer.status !== 'in') return null

  const stack = player.stack
  const owed = sub(hand.currentBet, handPlayer.committedThisRound)
  const maxRaiseTo = add(handPlayer.committedThisRound, stack)

  // A re-raise has to lift the bet by at least as much as the last raise did.
  const minRaiseTo = add(hand.currentBet, max(hand.lastRaiseSize, hand.minBet))

  const facingBet = owed > 0
  const hasChips = stack > 0

  let raiseBlockedReason: string | null = null
  let canRaise = false

  if (facingBet || hand.currentBet > 0) {
    if (handPlayer.hasActedThisRound) {
      // They already had their turn and what came back at them was not a full
      // raise. They can only call or fold.
      raiseBlockedReason = 'An all-in for less than a full raise does not reopen the betting'
    } else if (maxRaiseTo < minRaiseTo) {
      raiseBlockedReason = 'Not enough chips for a full raise — all-in instead'
    } else {
      canRaise = true
    }
  }

  const canBet = isZero(hand.currentBet) && stack >= hand.minBet

  return {
    playerId: handPlayer.playerId,
    canFold: true,
    canCheck: !facingBet,
    canCall: facingBet && hasChips,
    callAmount: min(owed, stack),
    callIsAllIn: facingBet && owed >= stack,
    canBet,
    canRaise,
    minRaiseTo: isZero(hand.currentBet) ? hand.minBet : minRaiseTo,
    maxRaiseTo,
    canAllIn: hasChips,
    allInTo: maxRaiseTo,
    raiseBlockedReason,
  }
}

// ---------------------------------------------------------------------------
// Applying an action
// ---------------------------------------------------------------------------

export interface ActionOutcome {
  readonly hand: Hand
  /** Chips to take off the acting player's stack. */
  readonly chipsTaken: Money
}

function replacePlayer(hand: Hand, updated: HandPlayer): Hand {
  return {
    ...hand,
    players: hand.players.map((p) => (p.playerId === updated.playerId ? updated : p)),
  }
}

/**
 * Move a player's contribution for this round up to `targetThisRound`,
 * capped at what they can afford. Returns the chips that actually moved.
 */
function commitTo(
  hand: Hand,
  playerId: PlayerId,
  targetThisRound: Money,
  stack: Money,
): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  const shortfall = sub(targetThisRound, player.committedThisRound)
  if (shortfall < 0) {
    throw new RuleError('Cannot reduce an amount already committed this round')
  }

  const taken = min(shortfall, stack)
  const goesAllIn = taken >= stack

  const updated: HandPlayer = {
    ...player,
    status: goesAllIn ? 'allIn' : player.status,
    committedThisRound: add(player.committedThisRound, taken),
    committedTotal: add(player.committedTotal, taken),
    hasActedThisRound: true,
  }

  return { hand: replacePlayer(hand, updated), chipsTaken: taken }
}

/**
 * Record that the bet level went up, and decide whether everyone else gets
 * another turn.
 *
 * A raise counts as a real raise when it lifts the bet by at least as much as
 * the previous raise did. Then the round reopens for everybody. An all-in that
 * limps over the line by less than that moves the price up but does *not* give
 * players who have already acted the right to raise again.
 */
function applyAggression(hand: Hand, actorId: PlayerId, newLevel: Money): Hand {
  if (newLevel <= hand.currentBet) return hand

  const increment = sub(newLevel, hand.currentBet)
  const isFullRaise = increment >= hand.lastRaiseSize

  const players = isFullRaise
    ? hand.players.map((p) =>
        p.playerId === actorId || p.status !== 'in' ? p : { ...p, hasActedThisRound: false },
      )
    : hand.players

  return {
    ...hand,
    players,
    currentBet: newLevel,
    lastRaiseSize: isFullRaise ? increment : hand.lastRaiseSize,
  }
}

export function applyFold(hand: Hand, playerId: PlayerId): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')

  return {
    hand: replacePlayer(hand, { ...player, status: 'folded', hasActedThisRound: true }),
    chipsTaken: ZERO,
  }
}

export function applyCheck(hand: Hand, playerId: PlayerId): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')
  if (player.committedThisRound < hand.currentBet) {
    throw new RuleError('Cannot check with a bet outstanding — call, raise or fold')
  }

  return {
    hand: replacePlayer(hand, { ...player, hasActedThisRound: true }),
    chipsTaken: ZERO,
  }
}

export function applyCall(hand: Hand, playerId: PlayerId, stack: Money): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')
  if (player.committedThisRound >= hand.currentBet) {
    throw new RuleError('Nothing to call — check instead')
  }

  return commitTo(hand, playerId, hand.currentBet, stack)
}

/**
 * `override` waives the *sizing* rules when a table agrees to something
 * non-standard. It never waives arithmetic: nobody can put in more than they
 * have, and a raise still has to be a raise.
 */
export interface ActionOptions {
  readonly override?: boolean
}

export function applyBet(
  hand: Hand,
  playerId: PlayerId,
  toAmount: Money,
  stack: Money,
  options: ActionOptions = {},
): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')
  if (!isZero(hand.currentBet)) throw new RuleError('There is already a bet — raise instead')

  const allIn = add(player.committedThisRound, stack)
  if (!isPositive(toAmount)) throw new RuleError('A bet has to be more than nothing')
  if (!options.override && toAmount < hand.minBet && toAmount < allIn) {
    throw new RuleError(`Minimum bet is ${hand.minBet}`)
  }
  if (toAmount > allIn) throw new RuleError('Cannot bet more than your stack')

  const outcome = commitTo(hand, playerId, toAmount, stack)
  return { ...outcome, hand: applyAggression(outcome.hand, playerId, toAmount) }
}

export function applyRaise(
  hand: Hand,
  playerId: PlayerId,
  toAmount: Money,
  stack: Money,
  options: ActionOptions = {},
): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')
  if (!options.override && player.hasActedThisRound) {
    throw new RuleError('Betting was not reopened — you may only call or fold')
  }

  const allIn = add(player.committedThisRound, stack)
  if (toAmount <= hand.currentBet) throw new RuleError('A raise must be more than the current bet')
  if (toAmount > allIn) throw new RuleError('Cannot raise more than your stack')

  const minRaiseTo = add(hand.currentBet, max(hand.lastRaiseSize, hand.minBet))
  if (!options.override && toAmount < minRaiseTo && toAmount < allIn) {
    throw new RuleError(`Minimum raise is to ${minRaiseTo}`)
  }

  const outcome = commitTo(hand, playerId, toAmount, stack)
  return { ...outcome, hand: applyAggression(outcome.hand, playerId, toAmount) }
}

export function applyAllIn(hand: Hand, playerId: PlayerId, stack: Money): ActionOutcome {
  const player = requireHandPlayer(hand, playerId)
  if (player.status !== 'in') throw new RuleError('That player cannot act')
  if (isZero(stack)) throw new RuleError('No chips left to put in')

  const toAmount = add(player.committedThisRound, stack)
  const outcome = commitTo(hand, playerId, toAmount, stack)
  return { ...outcome, hand: applyAggression(outcome.hand, playerId, toAmount) }
}

// ---------------------------------------------------------------------------
// Closing a round and moving on
// ---------------------------------------------------------------------------

/**
 * Is this round of betting finished?
 *
 * Yes when everyone who can still act has had a turn and has matched the
 * current bet. Players who folded or are all-in are simply not counted.
 */
export function isRoundComplete(hand: Hand): boolean {
  const contesting = hand.players.filter((p) => p.status !== 'folded')
  if (contesting.length <= 1) return true

  const canAct = hand.players.filter((p) => p.status === 'in')
  if (canAct.length === 0) return true

  return canAct.every((p) => p.hasActedThisRound && p.committedThisRound === hand.currentBet)
}

/**
 * Work out what happens after an action: pass the turn, open the next round,
 * or stop and ask who won.
 */
export function advance(hand: Hand): Hand {
  // Everyone else folded. No cards need showing.
  const contesting = hand.players.filter((p) => p.status !== 'folded')
  if (contesting.length <= 1) {
    return { ...hand, phase: 'awaitingWinner', toActId: null }
  }

  if (!isRoundComplete(hand)) {
    const next = hand.toActId ? nextToActId(hand, hand.toActId) : firstToActId(hand)
    return { ...hand, toActId: next }
  }

  // Round is done. Sweep this round's bets into the pot and clear the slate.
  const swept = hand.players.map((p) => ({
    ...p,
    committedThisRound: ZERO,
    hasActedThisRound: false,
  }))

  const stillBetting = swept.filter((p) => p.status === 'in')
  const roundIndex = BETTING_ROUNDS.indexOf(hand.round)
  const isLastRound = roundIndex >= BETTING_ROUNDS.length - 1

  // With at most one player able to bet, later rounds cannot change anything,
  // so there is no point walking through them.
  if (isLastRound || stillBetting.length <= 1) {
    return {
      ...hand,
      players: swept,
      phase: 'awaitingWinner',
      toActId: null,
      currentBet: ZERO,
    }
  }

  const nextRound = BETTING_ROUNDS[roundIndex + 1]
  if (!nextRound) throw new RuleError('Ran off the end of the betting rounds')

  const opened: Hand = {
    ...hand,
    players: swept,
    round: nextRound,
    currentBet: ZERO,
    lastRaiseSize: hand.minBet,
    toActId: null,
  }

  return { ...opened, toActId: firstToActId(opened) }
}

// ---------------------------------------------------------------------------
// Convenience for the UI
// ---------------------------------------------------------------------------

/** Total sitting in the middle, every round included. */
export function potTotal(hand: Hand): Money {
  return money(hand.players.reduce((total, p) => total + p.committedTotal, 0))
}

/** Committed during the current round only — shown in front of each player. */
export function roundTotal(hand: Hand): Money {
  return money(hand.players.reduce((total, p) => total + p.committedThisRound, 0))
}

/** Order odd chips are handed out in, and the order players speak in. */
export function speakingOrder(hand: Hand): readonly PlayerId[] {
  return clockwiseFromDealer(hand)
}

/** Chips a player still owes to stay in. Never more than they have. */
export function amountOwed(hand: Hand, playerId: PlayerId, stack: Money): Money {
  const player = requireHandPlayer(hand, playerId)
  return min(deduct(max(hand.currentBet, player.committedThisRound), player.committedThisRound), stack)
}
