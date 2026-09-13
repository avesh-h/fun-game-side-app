/**
 * Pots.
 *
 * This is where a pen-and-paper game usually goes wrong. Three rules do the
 * damage, and all three are handled here:
 *
 *   1. A player who is all-in for less can only win the part of the pot they
 *      paid into. Everything above that is a side pot they cannot touch.
 *   2. Money from players who folded stays in the pot. They just can never win
 *      it back.
 *   3. A bet nobody matched belongs to the person who made it, and has to come
 *      back before anything is handed out.
 */

import { add, deduct, money, split, sum, ZERO, type Money } from './money'
import type { Award, Hand, PlayerId } from './types'

/** What one player put into the hand in total, boot included. */
export interface PotContribution {
  readonly playerId: PlayerId
  readonly amount: Money
  readonly folded: boolean
}

export interface PotLayer {
  /** 0 is the main pot; everything above it is a side pot. */
  readonly index: number
  readonly amount: Money
  /** Only these players may be given this layer. */
  readonly eligible: readonly PlayerId[]
}

export function contributionsOf(hand: Hand): readonly PotContribution[] {
  return hand.players.map((p) => ({
    playerId: p.playerId,
    amount: p.committedTotal,
    folded: p.status === 'folded',
  }))
}

// ---------------------------------------------------------------------------
// Uncalled bets
// ---------------------------------------------------------------------------

export interface UncalledBet {
  readonly playerId: PlayerId
  readonly amount: Money
}

export interface UncalledResult {
  readonly contributions: readonly PotContribution[]
  readonly refund: UncalledBet | null
}

/**
 * Hand back the part of a bet that nobody covered.
 *
 * Someone shoves 500, everyone folds: only the portion others actually matched
 * is really in the pot. The rest was never at risk and is returned. Same thing
 * when a caller is all-in for less than the bet facing them.
 *
 * If two or more players are level at the top, everything was matched and
 * nothing comes back.
 */
export function returnUncalledBet(contributions: readonly PotContribution[]): UncalledResult {
  if (contributions.length < 2) {
    // A hand with nobody to play against — give it all back.
    const only = contributions[0]
    if (!only || only.amount === 0) return { contributions, refund: null }
    return {
      contributions: [{ ...only, amount: ZERO }],
      refund: { playerId: only.playerId, amount: only.amount },
    }
  }

  const sorted = [...contributions].sort((a, b) => b.amount - a.amount)
  const top = sorted[0]
  const second = sorted[1]
  if (!top || !second) return { contributions, refund: null }

  if (top.amount <= second.amount) return { contributions, refund: null }

  const excess = deduct(top.amount, second.amount, 'top contribution')
  return {
    contributions: contributions.map((c) =>
      c.playerId === top.playerId ? { ...c, amount: second.amount } : c,
    ),
    refund: { playerId: top.playerId, amount: excess },
  }
}

// ---------------------------------------------------------------------------
// Side pots
// ---------------------------------------------------------------------------

/**
 * Slice the contributions into a main pot and any side pots.
 *
 * Each distinct contribution level opens a layer. A layer is worth the step up
 * from the level below, multiplied by everyone who reached it — folded players
 * included, because their money is in there. Only players who did not fold can
 * be paid from it.
 *
 * Call `returnUncalledBet` first, or the top layer will just be somebody's own
 * unmatched bet handed back to them as a "pot".
 */
export function buildPots(contributions: readonly PotContribution[]): readonly PotLayer[] {
  const staked = contributions.filter((c) => c.amount > 0)
  if (staked.length === 0) return []

  const levels = [...new Set(staked.map((c) => c.amount))].sort((a, b) => a - b)

  const layers: PotLayer[] = []
  let previous = ZERO

  for (const level of levels) {
    const atLevel = money(level)
    const step = deduct(atLevel, previous, 'pot level')
    previous = atLevel

    const contributors = staked.filter((c) => c.amount >= atLevel)
    const amount = money(step * contributors.length)
    if (amount === 0) continue

    const eligible = contributors.filter((c) => !c.folded).map((c) => c.playerId)

    if (eligible.length === 0) {
      // Nobody left who can claim this slice. It belongs with the highest layer
      // that still has someone in it — dead money always falls to the best hand
      // able to take it. Eligibility only ever shrinks as levels rise, so the
      // layer below is the right home.
      const previousLayer = layers[layers.length - 1]
      if (!previousLayer) {
        throw new Error('Cannot build pots: every contributor folded')
      }
      layers[layers.length - 1] = {
        ...previousLayer,
        amount: add(previousLayer.amount, amount),
      }
      continue
    }

    // Two adjacent layers with exactly the same eligible players are not two
    // pots — whoever wins one always wins the other. This happens whenever a
    // folded player's money sits below everyone else's level. Merging keeps
    // the operator from being asked the same question twice.
    const sameClaimants = layers[layers.length - 1]
    if (sameClaimants && sameMembers(sameClaimants.eligible, eligible)) {
      layers[layers.length - 1] = {
        ...sameClaimants,
        amount: add(sameClaimants.amount, amount),
      }
      continue
    }

    layers.push({ index: layers.length, amount, eligible })
  }

  return layers
}

function sameMembers(a: readonly PlayerId[], b: readonly PlayerId[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

export function totalOfPots(pots: readonly PotLayer[]): Money {
  return sum(pots.map((p) => p.amount))
}

// ---------------------------------------------------------------------------
// Paying out
// ---------------------------------------------------------------------------

/**
 * Share one pot between its winners.
 *
 * When it will not divide evenly, the spare units go one at a time to the
 * winners sitting closest clockwise after the dealer. That is the standard
 * convention, and it matters because otherwise the odd chip has no owner and
 * the ledger stops balancing.
 */
export function distribute(
  amount: Money,
  winners: readonly PlayerId[],
  clockwiseFromDealer: readonly PlayerId[],
): readonly Award[] {
  if (winners.length === 0) {
    throw new Error('Cannot award a pot with no winners')
  }

  const unique = [...new Set(winners)]
  const { each, remainder } = split(amount, unique.length)

  const seatIndex = (id: PlayerId): number => {
    const i = clockwiseFromDealer.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }
  const ordered = [...unique].sort((a, b) => seatIndex(a) - seatIndex(b))

  return ordered.map((playerId, i) => ({
    playerId,
    amount: i < remainder ? add(each, money(1)) : each,
  }))
}

/**
 * Pay out every pot at once.
 *
 * `winnersByPot` lines up with `pots` by index: the winners of the main pot
 * first, then each side pot in turn.
 */
export function awardPots(
  pots: readonly PotLayer[],
  winnersByPot: readonly (readonly PlayerId[])[],
  clockwiseFromDealer: readonly PlayerId[],
): readonly Award[] {
  if (pots.length !== winnersByPot.length) {
    throw new Error(`Got ${pots.length} pots but ${winnersByPot.length} sets of winners`)
  }

  const awards: Award[] = []

  pots.forEach((pot, i) => {
    const winners = winnersByPot[i] ?? []
    const ineligible = winners.filter((w) => !pot.eligible.includes(w))
    if (ineligible.length > 0) {
      throw new Error(`Player ${ineligible[0]} is not eligible for pot ${i}`)
    }
    awards.push(...distribute(pot.amount, winners, clockwiseFromDealer))
  })

  return mergeAwards(awards)
}

/**
 * Turn hand strengths into a winner for every pot.
 *
 * This is what makes the card comparison tool work with side pots. The best
 * hand at the table does not necessarily win a pot it was not eligible for, so
 * each layer is decided among *its own* eligible players. Ties come back as
 * more than one winner, which is a split.
 */
export function bestEligiblePerPot(
  pots: readonly PotLayer[],
  scoreById: ReadonlyMap<PlayerId, number>,
): readonly (readonly PlayerId[])[] {
  return pots.map((pot) => {
    const scored = pot.eligible.filter((id) => scoreById.has(id))
    if (scored.length === 0) {
      throw new Error(`No hand was entered for anyone eligible for pot ${pot.index}`)
    }

    let best = -Infinity
    for (const id of scored) {
      const score = scoreById.get(id) ?? -Infinity
      if (score > best) best = score
    }

    return scored.filter((id) => scoreById.get(id) === best)
  })
}

/** Collapse several awards to the same player into one line. */
export function mergeAwards(awards: readonly Award[]): readonly Award[] {
  const byPlayer = new Map<PlayerId, Money>()
  for (const award of awards) {
    byPlayer.set(award.playerId, add(byPlayer.get(award.playerId) ?? ZERO, award.amount))
  }
  return [...byPlayer].map(([playerId, amount]) => ({ playerId, amount }))
}
