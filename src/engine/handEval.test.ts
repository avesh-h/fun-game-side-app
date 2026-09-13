import { describe, expect, it } from 'vitest'
import { cardOf, DECK_SIZE, SUITS, type Card } from './cards'
import {
  bestHand,
  CATEGORY,
  categoryOfScore,
  describeHand,
  resolveShowdown,
  scoreFive,
  type Category,
} from './handEval'

const RANK_CHARS: Readonly<Record<string, number>> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  T: 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

/** "As" -> ace of spades. Uppercase rank, lowercase suit. */
function card(text: string): Card {
  const rank = RANK_CHARS[text.slice(0, -1)]
  const suit = SUITS.indexOf(text.slice(-1) as (typeof SUITS)[number])
  if (rank === undefined || suit === -1) throw new Error(`Bad card: ${text}`)
  return cardOf(rank, suit)
}

/** "As Ks Qs Js Ts" -> five cards. */
function hand(text: string): Card[] {
  return text.split(' ').map(card)
}

function categoryOf(text: string): Category {
  return categoryOfScore(scoreFive(hand(text)))
}

// ---------------------------------------------------------------------------

describe('recognising each category', () => {
  it('finds every one of the ten', () => {
    expect(categoryOf('As Ks Qs Js Ts')).toBe(CATEGORY.StraightFlush) // royal
    expect(categoryOf('9h 8h 7h 6h 5h')).toBe(CATEGORY.StraightFlush)
    expect(categoryOf('9c 9d 9h 9s Kh')).toBe(CATEGORY.FourOfAKind)
    expect(categoryOf('Ah Ac Ad 3s 3h')).toBe(CATEGORY.FullHouse)
    expect(categoryOf('Kc Tc 8c 7c 5c')).toBe(CATEGORY.Flush)
    expect(categoryOf('Td 9c 8d 7h 6s')).toBe(CATEGORY.Straight)
    expect(categoryOf('7h 7d 7c Qs 3h')).toBe(CATEGORY.ThreeOfAKind)
    expect(categoryOf('Jh Jc 5d 5s 7h')).toBe(CATEGORY.TwoPair)
    expect(categoryOf('Ah Ac Kd Jc 7h')).toBe(CATEGORY.Pair)
    expect(categoryOf('Kh 8c Qd 2s 7h')).toBe(CATEGORY.HighCard)
  })

  it('ranks the categories in the right order', () => {
    const ladder = [
      'Kh 8c Qd 2s 7h', // high card
      'Ah Ac Kd Jc 7h', // pair
      'Jh Jc 5d 5s 7h', // two pair
      '7h 7d 7c Qs 3h', // trips
      'Td 9c 8d 7h 6s', // straight
      'Kc Tc 8c 7c 5c', // flush
      'Ah Ac Ad 3s 3h', // full house
      '9c 9d 9h 9s Kh', // quads
      '9h 8h 7h 6h 5h', // straight flush
    ].map((text) => scoreFive(hand(text)))

    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!).toBeGreaterThan(ladder[i - 1]!)
    }
  })
})

describe('straights, including the ones people argue about', () => {
  it('treats A-2-3-4-5 as a straight', () => {
    expect(categoryOf('Ah 2c 3d 4s 5h')).toBe(CATEGORY.Straight)
  })

  it('makes the wheel the weakest straight, because the ace plays low', () => {
    expect(scoreFive(hand('6c 5d 4h 3s 2c'))).toBeGreaterThan(scoreFive(hand('Ah 2c 3d 4s 5h')))
  })

  it('does not let rankings wrap around', () => {
    // Q-K-A-2-3 is not a run.
    expect(categoryOf('Qh Kc Ad 2s 3h')).toBe(CATEGORY.HighCard)
  })

  it('handles a five-high straight flush', () => {
    expect(categoryOf('Ah 2h 3h 4h 5h')).toBe(CATEGORY.StraightFlush)
    expect(scoreFive(hand('6s 5s 4s 3s 2s'))).toBeGreaterThan(scoreFive(hand('Ah 2h 3h 4h 5h')))
  })

  it('does not call a pair-containing run a straight', () => {
    expect(categoryOf('9h 9c 8d 7s 6h')).toBe(CATEGORY.Pair)
  })
})

describe('kickers', () => {
  it('compares the cards beyond the pair', () => {
    const better = scoreFive(hand('Ah Ac Kd Qc 7h'))
    const worse = scoreFive(hand('Ah Ac Kd Jc 7h'))
    expect(better).toBeGreaterThan(worse)
  })

  it('goes all the way to the fifth card', () => {
    const better = scoreFive(hand('Ah Ac Kd Jc 8h'))
    const worse = scoreFive(hand('Ah Ac Kd Jc 7h'))
    expect(better).toBeGreaterThan(worse)
  })

  it('separates two pair by the odd card', () => {
    expect(scoreFive(hand('Jh Jc 5d 5s Ah'))).toBeGreaterThan(scoreFive(hand('Jh Jc 5d 5s 7h')))
  })

  it('ranks the higher pair first regardless of the lower one', () => {
    expect(scoreFive(hand('Kh Kc 2d 2s 3h'))).toBeGreaterThan(scoreFive(hand('Qh Qc Jd Js Ah')))
  })

  it('calls two identical-strength hands an exact tie', () => {
    // Same ranks, different suits, no flush either way.
    expect(scoreFive(hand('Ah Ac Kd Jc 7h'))).toBe(scoreFive(hand('As Ad Kh Js 7c')))
  })
})

describe('bestHand — five out of seven', () => {
  it('picks the strongest combination available', () => {
    // Board gives four to a flush; the hole card completes it.
    const best = bestHand(hand('Kc Tc 8c 7c 2d Ac 3h'))
    expect(categoryOfScore(best.score)).toBe(CATEGORY.Flush)
  })

  it('will use only one hole card when that is better', () => {
    // Board brings 9-8-7-6; the ten completes it and the king is dead weight.
    const board = hand('9h 8d 7c 6s 2h')
    const best = bestHand([...board, ...hand('Ts Kd')])

    expect(categoryOfScore(best.score)).toBe(CATEGORY.Straight)
    expect(describeHand(best.cards)).toBe('Straight, ten-high')
    expect(best.cards).toContain(card('Ts'))
    expect(best.cards).not.toContain(card('Kd'))
  })

  it('will use neither hole card when the board is best', () => {
    const board = hand('As Ks Qs Js Ts') // royal flush on the board
    const best = bestHand([...board, ...hand('2c 3d')])
    expect([...best.cards].sort()).toEqual([...board].sort())
  })

  it('refuses duplicate cards', () => {
    expect(() => bestHand(hand('As As Ks Qs Js Ts 9s'))).toThrow(/twice/)
  })

  it('refuses fewer than five cards', () => {
    expect(() => bestHand(hand('As Ks Qs Js'))).toThrow()
  })
})

describe('resolveShowdown', () => {
  const board = hand('Ah Kd 9c 4s 2h')

  it('names a single winner', () => {
    const results = resolveShowdown(board, [
      { id: 'raj', holeCards: hand('Ac Kh') }, // two pair, aces and kings
      { id: 'amit', holeCards: hand('Qs Jd') }, // ace high
    ])

    expect(results.filter((r) => r.isWinner).map((r) => r.id)).toEqual(['raj'])
    expect(results[0]?.description).toBe('Two pair, aces and kings')
  })

  it('reports a tie when both players play the board', () => {
    const royal = hand('As Ks Qs Js Ts')
    const results = resolveShowdown(royal, [
      { id: 'raj', holeCards: hand('2c 3d') },
      { id: 'amit', holeCards: hand('4h 5h') },
    ])

    expect(results.filter((r) => r.isWinner).map((r) => r.id).sort()).toEqual(['amit', 'raj'])
  })

  it('separates two players holding the same pair by their kicker', () => {
    const results = resolveShowdown(hand('Ah Kd 9c 4s 2h'), [
      { id: 'raj', holeCards: hand('Ac Qh') }, // aces, queen kicker
      { id: 'amit', holeCards: hand('Ad Jh') }, // aces, jack kicker
    ])

    expect(results.filter((r) => r.isWinner).map((r) => r.id)).toEqual(['raj'])
  })

  it('returns nothing for no players', () => {
    expect(resolveShowdown(board, [])).toEqual([])
  })
})

describe('describeHand', () => {
  it('names hands the way a person would say them', () => {
    expect(describeHand(hand('As Ks Qs Js Ts'))).toBe('Royal flush')
    expect(describeHand(hand('9h 8h 7h 6h 5h'))).toBe('Straight flush, nine-high')
    expect(describeHand(hand('9c 9d 9h 9s Kh'))).toBe('Four of a kind, nines')
    expect(describeHand(hand('Ah Ac Ad 3s 3h'))).toBe('Full house, aces over threes')
    expect(describeHand(hand('Kc Tc 8c 7c 5c'))).toBe('Flush, king-high')
    expect(describeHand(hand('Td 9c 8d 7h 6s'))).toBe('Straight, ten-high')
    expect(describeHand(hand('Ah 2c 3d 4s 5h'))).toBe('Straight, five-high')
    expect(describeHand(hand('7h 7d 7c Qs 3h'))).toBe('Three of a kind, sevens')
    expect(describeHand(hand('Jh Jc 5d 5s 7h'))).toBe('Two pair, jacks and fives')
    expect(describeHand(hand('6h 6d Kc 9s 2h'))).toBe('Pair of sixes')
    expect(describeHand(hand('Kh 8c Qd 2s 7h'))).toBe('King-high')
  })
})

// ---------------------------------------------------------------------------
// The proof
// ---------------------------------------------------------------------------

describe('exhaustive verification', () => {
  it(
    'reproduces the known frequency of every hand across all 2,598,960 deals',
    { timeout: 180_000 },
    () => {
      const counts = new Map<Category, number>()
      const distinctScores = new Set<number>()
      const royalScore = scoreFive(hand('As Ks Qs Js Ts'))
      let royals = 0
      let total = 0

      const five: Card[] = [0, 0, 0, 0, 0]

      for (let a = 0; a < DECK_SIZE - 4; a += 1) {
        five[0] = a
        for (let b = a + 1; b < DECK_SIZE - 3; b += 1) {
          five[1] = b
          for (let c = b + 1; c < DECK_SIZE - 2; c += 1) {
            five[2] = c
            for (let d = c + 1; d < DECK_SIZE - 1; d += 1) {
              five[3] = d
              for (let e = d + 1; e < DECK_SIZE; e += 1) {
                five[4] = e

                const score = scoreFive(five)
                const category = categoryOfScore(score)

                counts.set(category, (counts.get(category) ?? 0) + 1)
                distinctScores.add(score)
                if (score === royalScore) royals += 1
                total += 1
              }
            }
          }
        }
      }

      // Every five-card hand that can be dealt from a 52-card deck.
      expect(total).toBe(2_598_960)

      // These are fixed mathematical constants. Matching all nine exactly means
      // the evaluator cannot be misclassifying anything.
      expect(counts.get(CATEGORY.StraightFlush)).toBe(40)
      expect(counts.get(CATEGORY.FourOfAKind)).toBe(624)
      expect(counts.get(CATEGORY.FullHouse)).toBe(3_744)
      expect(counts.get(CATEGORY.Flush)).toBe(5_108)
      expect(counts.get(CATEGORY.Straight)).toBe(10_200)
      expect(counts.get(CATEGORY.ThreeOfAKind)).toBe(54_912)
      expect(counts.get(CATEGORY.TwoPair)).toBe(123_552)
      expect(counts.get(CATEGORY.Pair)).toBe(1_098_240)
      expect(counts.get(CATEGORY.HighCard)).toBe(1_302_540)

      // One per suit.
      expect(royals).toBe(4)

      // And the number of genuinely different hand strengths, which is only
      // right if every tiebreak is packed correctly too.
      expect(distinctScores.size).toBe(7_462)
    },
  )
})
