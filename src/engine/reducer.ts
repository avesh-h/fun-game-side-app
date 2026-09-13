/**
 * The reducer.
 *
 * One function, one rule: given the state before and an event, produce the
 * state after. It never mutates and never reaches outside itself, so replaying
 * the same events always lands on exactly the same state. That is what makes
 * undo trustworthy — there is nothing to "roll back", you just replay one
 * event fewer.
 */

import {
  advance,
  applyAllIn,
  applyBet,
  applyCall,
  applyCheck,
  applyFold,
  applyRaise,
  RuleError,
  startHand,
  type ActionOutcome,
} from './betting'
import type { GameEvent } from './events'
import { add, deduct, mul, sum, ZERO, type Money } from './money'
import {
  awardPots,
  buildPots,
  contributionsOf,
  returnUncalledBet,
  totalOfPots,
} from './pots'
import { clockwiseFromDealer } from './seating'
import type { GameConfig, GameState, Hand, HandRecord, Player, PlayerId } from './types'

export const EMPTY_STATE: GameState = {
  config: { initialBank: ZERO, boot: ZERO, rake: ZERO, minBet: ZERO, defaultBuyIn: ZERO },
  phase: 'setup',
  bank: ZERO,
  players: [],
  hand: null,
  history: [],
  lastDealerId: null,
  totalIssued: ZERO,
  totalRaked: ZERO,
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function requirePlayer(state: GameState, id: PlayerId): Player {
  const player = state.players.find((p) => p.id === id)
  if (!player) throw new RuleError(`No such player: ${id}`)
  return player
}

function requireHand(state: GameState): Hand {
  if (!state.hand) throw new RuleError('No hand is in progress')
  return state.hand
}

function credit(players: readonly Player[], id: PlayerId, amount: Money): readonly Player[] {
  if (amount === ZERO) return players
  return players.map((p) => (p.id === id ? { ...p, stack: add(p.stack, amount) } : p))
}

function debit(players: readonly Player[], id: PlayerId, amount: Money): readonly Player[] {
  if (amount === ZERO) return players
  return players.map((p) =>
    p.id === id ? { ...p, stack: deduct(p.stack, amount, `${p.name}'s stack`) } : p,
  )
}

/**
 * Chips cannot be added to a stack in the middle of a hand you are playing.
 * That is the table-stakes rule, and it also stops the side-pot maths being
 * quietly invalidated halfway through.
 */
function refuseIfContesting(state: GameState, id: PlayerId, what: string): void {
  const inHand = state.hand?.players.find((p) => p.playerId === id)
  if (inHand && inHand.status !== 'folded') {
    throw new RuleError(`Cannot ${what} while still in a hand`)
  }
}

function applyBettingOutcome(
  state: GameState,
  playerId: PlayerId,
  outcome: ActionOutcome,
): GameState {
  return {
    ...state,
    hand: advance(outcome.hand),
    players: debit(state.players, playerId, outcome.chipsTaken),
  }
}

// ---------------------------------------------------------------------------
// The reducer
// ---------------------------------------------------------------------------

export function reduce(state: GameState, event: GameEvent): GameState {
  switch (event.type) {
    // -- Session ----------------------------------------------------------

    case 'GameCreated': {
      const staked = sum(event.players.map((p) => p.buyIn))
      if (staked > event.config.initialBank) {
        throw new RuleError('Players cannot buy in for more than the bank holds')
      }
      if (event.players.length < 2) {
        throw new RuleError('Need at least two players to start')
      }

      // A session saved before the table charge existed has no `rake` on its
      // config. Defaulting it here means those games still load rather than
      // being thrown away.
      const config: GameConfig = { ...event.config, rake: event.config.rake ?? ZERO }

      return {
        config,
        phase: 'playing',
        bank: deduct(config.initialBank, staked, 'bank'),
        players: event.players.map((p, seat) => ({
          id: p.id,
          name: p.name,
          stack: p.buyIn,
          status: 'active' as const,
          totalTakenFromBank: p.buyIn,
          totalReturnedToBank: ZERO,
          seat,
        })),
        hand: null,
        history: [],
        lastDealerId: null,
        totalIssued: config.initialBank,
        totalRaked: ZERO,
      }
    }

    case 'SessionEnded': {
      if (state.hand) throw new RuleError('Finish or cancel the hand before ending the session')
      return { ...state, phase: 'ended' }
    }

    // -- Hand lifecycle ---------------------------------------------------

    case 'HandStarted': {
      if (state.hand) throw new RuleError('A hand is already in progress')
      if (state.phase !== 'playing') throw new RuleError('The game is not running')

      const { hand, charged } = startHand(state, event.dealerId)

      // The boot goes to the middle; the table charge goes straight back to
      // the bank. Both come off the stack in one movement.
      const players = charged.reduce(
        (acc, entry) => debit(acc, entry.playerId, add(entry.boot, entry.rake)),
        state.players,
      )
      const raked = sum(charged.map((entry) => entry.rake))

      return {
        ...state,
        hand,
        players,
        bank: add(state.bank, raked),
        totalRaked: add(state.totalRaked, raked),
      }
    }

    case 'PotAwarded': {
      const hand = requireHand(state)
      if (hand.phase !== 'awaitingWinner') {
        throw new RuleError('Betting is not finished yet')
      }

      // Give back anything nobody covered, then slice what is left into the
      // main pot and any side pots, then share each one out.
      const { contributions, refund } = returnUncalledBet(contributionsOf(hand))
      const pots = buildPots(contributions)
      const awards = awardPots(pots, event.winnersByPot, clockwiseFromDealer(hand))

      let players = state.players
      if (refund) players = credit(players, refund.playerId, refund.amount)
      for (const award of awards) players = credit(players, award.playerId, award.amount)

      const record: HandRecord = {
        number: hand.number,
        boot: hand.boot,
        dealerId: hand.dealerId,
        contributions: contributions
          .filter((c) => c.amount > 0)
          .map((c) => ({ playerId: c.playerId, amount: c.amount })),
        totalPot: totalOfPots(pots),
        raked: mul(hand.rake, hand.players.length),
        awards,
        endedAtRound: hand.round,
        wentToShowdown: event.wentToShowdown,
      }

      return {
        ...state,
        players,
        hand: null,
        lastDealerId: hand.dealerId,
        history: [...state.history, record],
      }
    }

    case 'HandCancelled': {
      const hand = requireHand(state)

      // Everything anyone put in comes straight back, the table charge
      // included — a scrapped hand should cost nobody anything. The dealer
      // marker stays put, so the same hand can simply be dealt again.
      const players = hand.players.reduce(
        (acc, p) => credit(acc, p.playerId, add(p.committedTotal, hand.rake)),
        state.players,
      )
      const rakeBack = mul(hand.rake, hand.players.length)

      return {
        ...state,
        players,
        hand: null,
        bank: deduct(state.bank, rakeBack, 'bank'),
        totalRaked: deduct(state.totalRaked, rakeBack, 'total raked'),
      }
    }

    // -- Betting ----------------------------------------------------------

    case 'Folded': {
      const hand = requireHand(state)
      return applyBettingOutcome(state, event.playerId, applyFold(hand, event.playerId))
    }

    case 'Checked': {
      const hand = requireHand(state)
      return applyBettingOutcome(state, event.playerId, applyCheck(hand, event.playerId))
    }

    case 'Called': {
      const hand = requireHand(state)
      const player = requirePlayer(state, event.playerId)
      return applyBettingOutcome(
        state,
        event.playerId,
        applyCall(hand, event.playerId, player.stack),
      )
    }

    case 'BetPlaced': {
      const hand = requireHand(state)
      const player = requirePlayer(state, event.playerId)
      return applyBettingOutcome(
        state,
        event.playerId,
        applyBet(hand, event.playerId, event.toAmount, player.stack, {
          override: event.override ?? false,
        }),
      )
    }

    case 'Raised': {
      const hand = requireHand(state)
      const player = requirePlayer(state, event.playerId)
      return applyBettingOutcome(
        state,
        event.playerId,
        applyRaise(hand, event.playerId, event.toAmount, player.stack, {
          override: event.override ?? false,
        }),
      )
    }

    case 'WentAllIn': {
      const hand = requireHand(state)
      const player = requirePlayer(state, event.playerId)
      return applyBettingOutcome(
        state,
        event.playerId,
        applyAllIn(hand, event.playerId, player.stack),
      )
    }

    // -- Money and roster -------------------------------------------------

    case 'PlayerAdded': {
      if (state.players.some((p) => p.id === event.player.id)) {
        throw new RuleError('That player is already seated')
      }

      const seat = state.players.reduce((highest, p) => Math.max(highest, p.seat), -1) + 1

      return {
        ...state,
        bank: deduct(state.bank, event.player.buyIn, 'bank'),
        players: [
          ...state.players,
          {
            id: event.player.id,
            name: event.player.name,
            stack: event.player.buyIn,
            status: 'active',
            totalTakenFromBank: event.player.buyIn,
            totalReturnedToBank: ZERO,
            seat,
          },
        ],
      }
    }

    case 'ReBought': {
      const player = requirePlayer(state, event.playerId)
      if (player.status === 'left') throw new RuleError('That player has already cashed out')
      if (event.amount <= ZERO) throw new RuleError('A re-buy must be more than nothing')
      refuseIfContesting(state, event.playerId, 're-buy')

      return {
        ...state,
        bank: deduct(state.bank, event.amount, 'bank'),
        players: state.players.map((p) =>
          p.id === event.playerId
            ? {
                ...p,
                stack: add(p.stack, event.amount),
                totalTakenFromBank: add(p.totalTakenFromBank, event.amount),
              }
            : p,
        ),
      }
    }

    case 'CashedOut': {
      const player = requirePlayer(state, event.playerId)
      if (player.status === 'left') throw new RuleError('That player has already cashed out')
      refuseIfContesting(state, event.playerId, 'cash out')

      return {
        ...state,
        bank: add(state.bank, player.stack),
        players: state.players.map((p) =>
          p.id === event.playerId
            ? {
                ...p,
                stack: ZERO,
                status: 'left' as const,
                // Remember what they walked away with, or the totals would say
                // they lost every chip they ever took.
                totalReturnedToBank: add(p.totalReturnedToBank, p.stack),
              }
            : p,
        ),
      }
    }

    case 'SatOut': {
      const player = requirePlayer(state, event.playerId)
      if (player.status !== 'active') throw new RuleError('That player is not currently playing')
      refuseIfContesting(state, event.playerId, 'sit out')

      return {
        ...state,
        players: state.players.map((p) =>
          p.id === event.playerId ? { ...p, status: 'sittingOut' as const } : p,
        ),
      }
    }

    case 'SatIn': {
      const player = requirePlayer(state, event.playerId)
      if (player.status !== 'sittingOut') throw new RuleError('That player is not sitting out')

      return {
        ...state,
        players: state.players.map((p) =>
          p.id === event.playerId ? { ...p, status: 'active' as const } : p,
        ),
      }
    }

    case 'BankToppedUp': {
      if (event.amount <= ZERO) throw new RuleError('A top-up must be more than nothing')
      return {
        ...state,
        bank: add(state.bank, event.amount),
        totalIssued: add(state.totalIssued, event.amount),
      }
    }
  }
}

/**
 * Rebuild the whole session from its events.
 *
 * This is how state is loaded and how undo works: drop the last event and run
 * the rest through again.
 */
export function replay(events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, EMPTY_STATE)
}
