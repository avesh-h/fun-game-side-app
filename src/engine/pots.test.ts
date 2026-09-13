import { describe, expect, it } from 'vitest'
import { add, money, sum, ZERO, type Money } from './money'
import {
  awardPots,
  bestEligiblePerPot,
  buildPots,
  distribute,
  mergeAwards,
  returnUncalledBet,
  totalOfPots,
  type PotContribution,
} from './pots'
import { playerId, type PlayerId } from './types'

const P = (name: string): PlayerId => playerId(name)

const A = P('A')
const B = P('B')
const C = P('C')
const D = P('D')

function contrib(id: PlayerId, amount: number, folded = false): PotContribution {
  return { playerId: id, amount: money(amount), folded }
}

/** The property that matters most: nothing is created, nothing is lost. */
function expectBalanced(
  contributions: readonly PotContribution[],
  paidOut: Money,
  refunded: Money = ZERO,
) {
  const putIn = sum(contributions.map((c) => c.amount))
  expect(add(paidOut, refunded)).toBe(putIn)
}

// ---------------------------------------------------------------------------

describe('returnUncalledBet', () => {
  it('gives back a bet nobody matched', () => {
    const before = [contrib(A, 500), contrib(B, 200, true), contrib(C, 0, true)]
    const { contributions, refund } = returnUncalledBet(before)

    expect(refund).toEqual({ playerId: A, amount: 300 })
    expect(contributions.find((c) => c.playerId === A)?.amount).toBe(200)
  })

  it('returns nothing when the top two are level', () => {
    const before = [contrib(A, 300), contrib(B, 300), contrib(C, 100)]
    expect(returnUncalledBet(before).refund).toBeNull()
  })

  it('trims a bet down to what an all-in caller could cover', () => {
    // A shoves 400, B can only cover 250. The extra 150 was never at risk.
    const before = [contrib(A, 400), contrib(B, 250)]
    const { contributions, refund } = returnUncalledBet(before)

    expect(refund).toEqual({ playerId: A, amount: 150 })
    expect(contributions.find((c) => c.playerId === A)?.amount).toBe(250)
  })

  it('hands everything back when there is nobody to play against', () => {
    const { refund } = returnUncalledBet([contrib(A, 100)])
    expect(refund).toEqual({ playerId: A, amount: 100 })
  })
})

describe('buildPots', () => {
  it('makes a single pot when everyone put in the same', () => {
    const pots = buildPots([contrib(A, 100), contrib(B, 100), contrib(C, 100)])

    expect(pots).toHaveLength(1)
    expect(pots[0]?.amount).toBe(300)
    expect(pots[0]?.eligible).toEqual([A, B, C])
  })

  it('splits off a side pot when one player is all-in for less', () => {
    const pots = buildPots([contrib(A, 100), contrib(B, 300), contrib(C, 300)])

    expect(pots).toHaveLength(2)
    // Main pot: everyone reached 100.
    expect(pots[0]?.amount).toBe(300)
    expect(pots[0]?.eligible).toEqual([A, B, C])
    // Side pot: only B and C went beyond it, so only they can win it.
    expect(pots[1]?.amount).toBe(400)
    expect(pots[1]?.eligible).toEqual([B, C])

    expect(totalOfPots(pots)).toBe(700)
  })

  it('builds three layers for a three-way all-in at different levels', () => {
    const contributions = [contrib(A, 50), contrib(B, 150), contrib(C, 300), contrib(D, 300)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(3)
    expect(pots[0]).toMatchObject({ amount: 200, eligible: [A, B, C, D] })
    expect(pots[1]).toMatchObject({ amount: 300, eligible: [B, C, D] })
    expect(pots[2]).toMatchObject({ amount: 300, eligible: [C, D] })

    expect(totalOfPots(pots)).toBe(800)
    expectBalanced(contributions, totalOfPots(pots))
  })

  it('keeps a folded player money in the pot but never lets them win it', () => {
    const contributions = [contrib(A, 200, true), contrib(B, 200), contrib(C, 200)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(1)
    expect(pots[0]?.amount).toBe(600) // all three lots of 200 are in there
    expect(pots[0]?.eligible).toEqual([B, C]) // but A cannot be paid
  })

  it('handles a player who could not cover the full boot', () => {
    // Boot is 20; A only had 10 left.
    const contributions = [contrib(A, 10), contrib(B, 20), contrib(C, 20)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(2)
    expect(pots[0]).toMatchObject({ amount: 30, eligible: [A, B, C] })
    expect(pots[1]).toMatchObject({ amount: 20, eligible: [B, C] })
    expectBalanced(contributions, totalOfPots(pots))
  })

  it('folds a layer nobody can claim into the one below it', () => {
    // A and B both got to 500 and both folded; C is all-in for 200 and is the
    // only player left. The 600 above C's level has no eligible claimant.
    const contributions = [contrib(A, 500, true), contrib(B, 500, true), contrib(C, 200)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(1)
    expect(pots[0]?.eligible).toEqual([C])
    expect(pots[0]?.amount).toBe(1200)
    expectBalanced(contributions, totalOfPots(pots))
  })

  it('does not split out a pot that has the same claimants as the one below', () => {
    // Raj folded for 20; the other two both got to 420. That is two levels but
    // only one set of people who can win, so it is really one pot.
    const contributions = [contrib(A, 20, true), contrib(B, 420), contrib(C, 420)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(1)
    expect(pots[0]?.amount).toBe(860)
    expect(pots[0]?.eligible).toEqual([B, C])
    expectBalanced(contributions, totalOfPots(pots))
  })

  it('still separates pots when the claimants genuinely differ', () => {
    const contributions = [contrib(A, 20, true), contrib(B, 200), contrib(C, 420)]
    const pots = buildPots(contributions)

    expect(pots).toHaveLength(2)
    expect(pots[0]).toMatchObject({ amount: 420, eligible: [B, C] })
    expect(pots[1]).toMatchObject({ amount: 220, eligible: [C] })
    expectBalanced(contributions, totalOfPots(pots))
  })

  it('ignores players who put in nothing', () => {
    const pots = buildPots([contrib(A, 100), contrib(B, 100), contrib(C, 0, true)])
    expect(pots).toHaveLength(1)
    expect(pots[0]?.eligible).toEqual([A, B])
  })

  it('returns no pots at all when nothing was staked', () => {
    expect(buildPots([contrib(A, 0), contrib(B, 0)])).toEqual([])
  })
})

describe('everyone folds to a bet', () => {
  it('returns the unmatched part, then pays the rest to the bettor', () => {
    const raw = [contrib(A, 500), contrib(B, 200, true), contrib(C, 0, true)]

    const { contributions, refund } = returnUncalledBet(raw)
    const pots = buildPots(contributions)
    const awards = awardPots(pots, [[A]], [A, B, C])

    expect(refund?.amount).toBe(300)
    expect(totalOfPots(pots)).toBe(400) // A's matched 200 plus B's dead 200
    expect(awards).toEqual([{ playerId: A, amount: 400 }])

    // A staked 500 and comes away with 700, so is up exactly B's 200.
    expectBalanced(raw, sum(awards.map((a) => a.amount)), refund?.amount ?? ZERO)
  })
})

describe('distribute', () => {
  it('splits a pot evenly', () => {
    const awards = distribute(money(900), [A, B, C], [A, B, C])
    expect(awards).toEqual([
      { playerId: A, amount: 300 },
      { playerId: B, amount: 300 },
      { playerId: C, amount: 300 },
    ])
  })

  it('gives the odd unit to the winner nearest clockwise from the dealer', () => {
    // Order after the dealer is C, then B. C is closer, so C takes the extra.
    const awards = distribute(money(175), [B, C], [C, B, A])

    expect(awards).toEqual([
      { playerId: C, amount: 88 },
      { playerId: B, amount: 87 },
    ])
    expect(sum(awards.map((a) => a.amount))).toBe(175)
  })

  it('spreads more than one spare unit, one each, in clockwise order', () => {
    const awards = distribute(money(11), [A, B, C], [A, B, C])

    expect(awards).toEqual([
      { playerId: A, amount: 4 },
      { playerId: B, amount: 4 },
      { playerId: C, amount: 3 },
    ])
    expect(sum(awards.map((a) => a.amount))).toBe(11)
  })

  it('refuses to award a pot to nobody', () => {
    expect(() => distribute(money(100), [], [A])).toThrow()
  })
})

describe('awardPots', () => {
  it('pays each layer to its own winner', () => {
    const contributions = [contrib(A, 100), contrib(B, 300), contrib(C, 300)]
    const pots = buildPots(contributions)

    // A takes the main pot with the best hand; B beats C for the side pot.
    const awards = awardPots(pots, [[A], [B]], [A, B, C])

    expect(awards).toContainEqual({ playerId: A, amount: 300 })
    expect(awards).toContainEqual({ playerId: B, amount: 400 })
    expectBalanced(contributions, sum(awards.map((a) => a.amount)))
  })

  it('combines a player who wins more than one pot into one line', () => {
    const contributions = [contrib(A, 100), contrib(B, 300), contrib(C, 300)]
    const pots = buildPots(contributions)
    const awards = awardPots(pots, [[B], [B]], [A, B, C])

    expect(awards).toEqual([{ playerId: B, amount: 700 }])
  })

  it('refuses to pay a player who is not eligible for that pot', () => {
    const pots = buildPots([contrib(A, 100), contrib(B, 300), contrib(C, 300)])
    // A was all-in for 100 and cannot be given the side pot.
    expect(() => awardPots(pots, [[A], [A]], [A, B, C])).toThrow(/not eligible/)
  })

  it('rejects a mismatched number of winner sets', () => {
    const pots = buildPots([contrib(A, 100), contrib(B, 100)])
    expect(() => awardPots(pots, [], [A, B])).toThrow()
  })
})

describe('bestEligiblePerPot', () => {
  // A is all-in for 200; B and C carry on to 520 each.
  const contributions = [contrib(A, 200), contrib(B, 520), contrib(C, 520)]
  const pots = buildPots(contributions)

  it('does not give a pot to the best hand if it was not eligible for it', () => {
    // A has the strongest hand at the table, but only paid into the main pot.
    const scores = new Map([
      [A, 9_000],
      [B, 5_000],
      [C, 3_000],
    ])

    expect(bestEligiblePerPot(pots, scores)).toEqual([[A], [B]])
  })

  it('returns every tied player, which is a split', () => {
    const scores = new Map([
      [A, 5_000],
      [B, 5_000],
      [C, 3_000],
    ])

    expect(bestEligiblePerPot(pots, scores)).toEqual([[A, B], [B]])
  })

  it('lets one player sweep both pots when they simply have the best hand', () => {
    const scores = new Map([
      [A, 1_000],
      [B, 2_000],
      [C, 9_000],
    ])

    expect(bestEligiblePerPot(pots, scores)).toEqual([[C], [C]])
  })

  it('refuses to guess when a pot has nobody with a hand entered', () => {
    expect(() => bestEligiblePerPot(pots, new Map([[A, 9_000]]))).toThrow(/pot 1/)
  })
})

describe('mergeAwards', () => {
  it('adds up repeated payouts to the same player', () => {
    expect(
      mergeAwards([
        { playerId: A, amount: money(100) },
        { playerId: B, amount: money(50) },
        { playerId: A, amount: money(25) },
      ]),
    ).toEqual([
      { playerId: A, amount: 125 },
      { playerId: B, amount: 50 },
    ])
  })
})
