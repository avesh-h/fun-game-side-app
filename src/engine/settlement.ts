/**
 * The end of the night.
 *
 * One question: who is up and who is down? Each player took money out of the
 * bank and finished holding some amount. The difference is their result, and
 * because the bank is the only source of money, every result added together
 * must come to exactly zero.
 *
 * That last property is the proof the whole session was recorded correctly.
 */

import { potTotal } from './betting'
import { add, sub, sum, ZERO, type Money } from './money'
import type { GameState, Player } from './types'

export interface Standing {
  readonly player: Player
  /** Everything they ever took out of the bank. */
  readonly tookFromBank: Money
  /**
   * What they finished with — chips in front of them, plus anything already
   * handed back if they cashed out and left.
   */
  readonly finishedWith: Money
  /** finishedWith − tookFromBank. Positive means up on the night. */
  readonly net: Money
}

export interface Settlement {
  /** Biggest winner first. */
  readonly standings: readonly Standing[]
  readonly totalTaken: Money
  readonly totalFinished: Money
  readonly bank: Money
  readonly totalIssued: Money
  /**
   * Every result added together.
   *
   * Zero on a clean finish. It comes to minus the pot while a hand is running,
   * because that money has not been won yet, and minus anything the table
   * charge has taken, because that has gone back to the bank. So the identity
   * that must always hold is:
   *
   *     netSum + potInPlay + totalRaked  ==  0
   */
  readonly netSum: Money
  /** Everything the table charge has taken off the players this session. */
  readonly totalRaked: Money
  /** Chips sitting in front of players right now. */
  readonly liveStacks: Money
  /** Chips in the middle right now. Zero between hands. */
  readonly potInPlay: Money
  /** bank + every stack + the pot. Must equal totalIssued, always. */
  readonly accountedFor: Money
  readonly balances: boolean
  /** True while a hand is running, when the standings are provisional. */
  readonly handInProgress: boolean
}

export function finishedWith(player: Player): Money {
  return add(player.stack, player.totalReturnedToBank)
}

export function netResult(player: Player): Money {
  return sub(finishedWith(player), player.totalTakenFromBank)
}

export function settle(state: GameState): Settlement {
  const standings: Standing[] = state.players
    .map((player) => ({
      player,
      tookFromBank: player.totalTakenFromBank,
      finishedWith: finishedWith(player),
      net: netResult(player),
    }))
    // Biggest winner at the top; ties fall back to name so the order is stable
    // rather than depending on seat.
    .sort((a, b) => b.net - a.net || a.player.name.localeCompare(b.player.name))

  const totalTaken = sum(standings.map((s) => s.tookFromBank))
  const totalFinished = sum(standings.map((s) => s.finishedWith))
  const netSum = sum(standings.map((s) => s.net))

  // Money returned by players who left is already sitting in the bank, so
  // counting it here too would double it. Only live stacks are added.
  const liveStacks = sum(state.players.map((p) => p.stack))
  const potInPlay = state.hand ? potTotal(state.hand) : ZERO
  const accountedFor = add(state.bank, liveStacks, potInPlay)

  return {
    standings,
    totalTaken,
    totalFinished,
    bank: state.bank,
    totalIssued: state.totalIssued,
    netSum,
    totalRaked: state.totalRaked,
    liveStacks,
    potInPlay,
    accountedFor,
    balances:
      accountedFor === state.totalIssued &&
      add(netSum, potInPlay, state.totalRaked) === ZERO,
    handInProgress: state.hand !== null,
  }
}
