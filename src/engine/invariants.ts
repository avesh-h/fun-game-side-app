/**
 * The safety net.
 *
 * The bank is the only place money is created, and money is never destroyed.
 * So at every moment, from the first buy-in to the last hand of the night:
 *
 *     bank + every stack + whatever is in the middle  ==  money ever issued
 *
 * This is checked after every event. If it ever fails, something in the engine
 * is wrong and the ledger can no longer be trusted — so the app says so, loudly
 * and immediately, instead of quietly drifting for another two hours.
 */

import { potTotal } from './betting'
import { add, formatMoney, sub, sum, ZERO, type Money } from './money'
import type { GameState } from './types'

export interface InvariantReport {
  readonly ok: boolean
  /** What the total should be — everything the bank has ever issued. */
  readonly expected: Money
  /** What it actually adds up to right now. */
  readonly actual: Money
  /** actual − expected. Zero when all is well. */
  readonly difference: Money
  readonly bank: Money
  readonly stacks: Money
  readonly pot: Money
  /** Plain-English description of anything wrong. Empty when healthy. */
  readonly problems: readonly string[]
}

export function checkMoney(state: GameState): InvariantReport {
  const bank = state.bank
  const stacks = sum(state.players.map((p) => p.stack))
  const pot = state.hand ? potTotal(state.hand) : ZERO

  const actual = add(bank, stacks, pot)
  const expected = state.totalIssued
  const difference = sub(actual, expected)

  const problems: string[] = []

  if (difference !== ZERO) {
    const direction = difference > 0 ? 'more' : 'less'
    problems.push(
      `The table holds ${formatMoney(actual)} but the bank only ever issued ` +
        `${formatMoney(expected)} — ${formatMoney(sub(actual, expected))} ${direction} than it should.`,
    )
  }

  if (bank < 0) {
    problems.push(`The bank has gone negative (${formatMoney(bank)}).`)
  }

  for (const player of state.players) {
    if (player.stack < 0) {
      problems.push(`${player.name}'s stack is negative (${formatMoney(player.stack)}).`)
    }
    if (player.totalTakenFromBank < 0) {
      problems.push(`${player.name} has taken a negative amount from the bank.`)
    }
  }

  const hand = state.hand
  if (hand) {
    for (const p of hand.players) {
      if (p.committedThisRound > p.committedTotal) {
        problems.push(
          `A player has put in more this round than across the whole hand, which is impossible.`,
        )
        break
      }
    }

    const highest = hand.players.reduce<Money>(
      (best, p) => (p.committedThisRound > best ? p.committedThisRound : best),
      ZERO,
    )
    if (hand.currentBet !== highest) {
      problems.push(
        `The bet to match says ${formatMoney(hand.currentBet)} but the largest amount ` +
          `actually in front of anyone is ${formatMoney(highest)}.`,
      )
    }
  }

  return { ok: problems.length === 0, expected, actual, difference, bank, stacks, pot, problems }
}
