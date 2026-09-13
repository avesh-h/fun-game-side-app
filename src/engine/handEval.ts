/**
 * Hand evaluation.
 *
 * Given five cards, produce one number where bigger always means better. That
 * single number makes comparing players trivial, and makes an exact tie — the
 * thing that splits a pot — simply two equal numbers.
 *
 * No lookup tables, no API, no model. Just arithmetic. A shipped table of all
 * 2,598,960 hands would be megabytes to avoid work that takes microseconds,
 * and anything probabilistic has no business deciding who wins money.
 */

import { rankOf, rankWord, suitOf, type Card } from './cards'

export const CATEGORY = {
  HighCard: 0,
  Pair: 1,
  TwoPair: 2,
  ThreeOfAKind: 3,
  Straight: 4,
  Flush: 5,
  FullHouse: 6,
  FourOfAKind: 7,
  StraightFlush: 8,
} as const

export type Category = (typeof CATEGORY)[keyof typeof CATEGORY]

export const CATEGORY_NAMES: Readonly<Record<Category, string>> = {
  [CATEGORY.HighCard]: 'High card',
  [CATEGORY.Pair]: 'Pair',
  [CATEGORY.TwoPair]: 'Two pair',
  [CATEGORY.ThreeOfAKind]: 'Three of a kind',
  [CATEGORY.Straight]: 'Straight',
  [CATEGORY.Flush]: 'Flush',
  [CATEGORY.FullHouse]: 'Full house',
  [CATEGORY.FourOfAKind]: 'Four of a kind',
  [CATEGORY.StraightFlush]: 'Straight flush',
}

/**
 * Pack a category and up to five tiebreak ranks into one comparable integer.
 *
 * Each rank is 2-14 so it fits in 4 bits. Six slots of 4 bits is well inside
 * the safe integer range, so ordinary `>` comparison is exact.
 */
function pack(category: Category, tiebreaks: readonly number[]): number {
  let value: number = category
  for (let i = 0; i < 5; i += 1) {
    value = value * 16 + (tiebreaks[i] ?? 0)
  }
  return value
}

export function categoryOfScore(score: number): Category {
  return Math.floor(score / 16 ** 5) as Category
}

// ---------------------------------------------------------------------------
// The scorer
// ---------------------------------------------------------------------------

/**
 * Score exactly five cards. Higher is better; equal means an exact tie.
 */
export function scoreFive(cards: readonly Card[]): number {
  if (cards.length !== 5) {
    throw new Error(`scoreFive needs exactly 5 cards, got ${cards.length}`)
  }

  const counts = new Array<number>(15).fill(0)
  let suitMask = 0

  for (const card of cards) {
    counts[rankOf(card)] = (counts[rankOf(card)] ?? 0) + 1
    suitMask |= 1 << suitOf(card)
  }

  // A flush means every card landed on the same suit, so exactly one bit is set.
  const isFlush = suitMask === 1 || suitMask === 2 || suitMask === 4 || suitMask === 8

  // Ranks present, highest first, with duplicates collapsed.
  const distinct: number[] = []
  for (let rank = 14; rank >= 2; rank -= 1) {
    if ((counts[rank] ?? 0) > 0) distinct.push(rank)
  }

  const straightHigh = findStraightHigh(distinct)
  const isStraight = straightHigh > 0

  if (isFlush && isStraight) return pack(CATEGORY.StraightFlush, [straightHigh])

  // Rank groups, biggest group first, then highest rank first. This ordering
  // is exactly the tiebreak order for every paired category.
  const groups = distinct
    .map((rank) => ({ rank, count: counts[rank] ?? 0 }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  const g0 = groups[0]
  const g1 = groups[1]
  const g2 = groups[2]
  const g3 = groups[3]
  if (!g0) throw new Error('Unreachable: five cards always produce a rank group')

  if (g0.count === 4) {
    return pack(CATEGORY.FourOfAKind, [g0.rank, g1?.rank ?? 0])
  }

  if (g0.count === 3 && g1?.count === 2) {
    return pack(CATEGORY.FullHouse, [g0.rank, g1.rank])
  }

  if (isFlush) return pack(CATEGORY.Flush, distinct)
  if (isStraight) return pack(CATEGORY.Straight, [straightHigh])

  if (g0.count === 3) {
    return pack(CATEGORY.ThreeOfAKind, [g0.rank, g1?.rank ?? 0, g2?.rank ?? 0])
  }

  if (g0.count === 2 && g1?.count === 2) {
    return pack(CATEGORY.TwoPair, [g0.rank, g1.rank, g2?.rank ?? 0])
  }

  if (g0.count === 2) {
    return pack(CATEGORY.Pair, [g0.rank, g1?.rank ?? 0, g2?.rank ?? 0, g3?.rank ?? 0])
  }

  return pack(CATEGORY.HighCard, distinct)
}

/**
 * Highest card of a straight, or 0 if these ranks are not a run.
 *
 * `distinct` must be sorted high to low. Two rules that trip people up:
 *   - A-2-3-4-5 is a straight, the lowest one, and counts as five-high.
 *   - Q-K-A-2-3 is not a straight. Rankings do not wrap around.
 */
function findStraightHigh(distinct: readonly number[]): number {
  if (distinct.length !== 5) return 0

  const high = distinct[0]
  const low = distinct[4]
  if (high === undefined || low === undefined) return 0

  if (high - low === 4) return high

  // The wheel: ace drops underneath the two.
  if (high === 14 && distinct[1] === 5 && distinct[2] === 4 && distinct[3] === 3 && low === 2) {
    return 5
  }

  return 0
}

// ---------------------------------------------------------------------------
// Best five out of however many you hold
// ---------------------------------------------------------------------------

export interface BestHand {
  readonly score: number
  /** The five cards that actually made the hand. */
  readonly cards: readonly Card[]
}

/**
 * Pick the strongest five-card hand available.
 *
 * In Hold'em this is called with seven cards — two in your hand plus the five
 * shared — and checks all 21 ways of choosing five. The best hand often uses
 * only one of your own cards, and sometimes neither.
 */
export function bestHand(cards: readonly Card[]): BestHand {
  if (cards.length < 5) {
    throw new Error(`Need at least 5 cards to make a hand, got ${cards.length}`)
  }
  if (new Set(cards).size !== cards.length) {
    throw new Error('The same card was supplied twice')
  }

  if (cards.length === 5) {
    return { score: scoreFive(cards), cards: [...cards] }
  }

  let bestScore = -1
  let bestCards: Card[] = []
  const n = cards.length
  const pick: Card[] = [0, 0, 0, 0, 0]

  for (let a = 0; a < n - 4; a += 1) {
    pick[0] = cards[a] as Card
    for (let b = a + 1; b < n - 3; b += 1) {
      pick[1] = cards[b] as Card
      for (let c = b + 1; c < n - 2; c += 1) {
        pick[2] = cards[c] as Card
        for (let d = c + 1; d < n - 1; d += 1) {
          pick[3] = cards[d] as Card
          for (let e = d + 1; e < n; e += 1) {
            pick[4] = cards[e] as Card
            const score = scoreFive(pick)
            if (score > bestScore) {
              bestScore = score
              bestCards = [...pick]
            }
          }
        }
      }
    }
  }

  return { score: bestScore, cards: bestCards }
}

// ---------------------------------------------------------------------------
// Naming, for the result screen
// ---------------------------------------------------------------------------

/** Plain English for a made hand, e.g. "Full house, aces over threes". */
export function describeHand(cards: readonly Card[]): string {
  const score = scoreFive(cards)
  const category = categoryOfScore(score)

  const counts = new Array<number>(15).fill(0)
  for (const card of cards) counts[rankOf(card)] = (counts[rankOf(card)] ?? 0) + 1

  const distinct: number[] = []
  for (let rank = 14; rank >= 2; rank -= 1) {
    if ((counts[rank] ?? 0) > 0) distinct.push(rank)
  }
  const groups = distinct
    .map((rank) => ({ rank, count: counts[rank] ?? 0 }))
    .sort((a, b) => b.count - a.count || b.rank - a.rank)

  const top = groups[0]?.rank ?? 0
  const second = groups[1]?.rank ?? 0
  const straightHigh = findStraightHigh(distinct)
  const highCard = distinct[0] ?? 0

  switch (category) {
    case CATEGORY.StraightFlush:
      return straightHigh === 14 ? 'Royal flush' : `Straight flush, ${rankWord(straightHigh)}-high`
    case CATEGORY.FourOfAKind:
      return `Four of a kind, ${rankWord(top, true)}`
    case CATEGORY.FullHouse:
      return `Full house, ${rankWord(top, true)} over ${rankWord(second, true)}`
    case CATEGORY.Flush:
      return `Flush, ${rankWord(highCard)}-high`
    case CATEGORY.Straight:
      return `Straight, ${rankWord(straightHigh)}-high`
    case CATEGORY.ThreeOfAKind:
      return `Three of a kind, ${rankWord(top, true)}`
    case CATEGORY.TwoPair:
      return `Two pair, ${rankWord(top, true)} and ${rankWord(second, true)}`
    case CATEGORY.Pair:
      return `Pair of ${rankWord(top, true)}`
    case CATEGORY.HighCard:
      return `${rankWord(highCard, false).replace(/^./, (c) => c.toUpperCase())}-high`
  }
}

// ---------------------------------------------------------------------------
// Showdown
// ---------------------------------------------------------------------------

export interface ShowdownEntry<Id> {
  readonly id: Id
  /** The player's two hole cards. */
  readonly holeCards: readonly Card[]
}

export interface ShowdownResult<Id> {
  readonly id: Id
  readonly score: number
  readonly best: readonly Card[]
  readonly description: string
  readonly isWinner: boolean
}

/**
 * Work out who wins, given the shared cards and each player's hole cards.
 *
 * More than one winner means an exact tie and therefore a split pot. That
 * happens more often than people expect — most obviously when the five shared
 * cards are the best hand for everyone and nobody's own cards improve on them.
 */
export function resolveShowdown<Id>(
  board: readonly Card[],
  entries: readonly ShowdownEntry<Id>[],
): readonly ShowdownResult<Id>[] {
  if (entries.length === 0) return []

  const scored = entries.map((entry) => {
    const best = bestHand([...board, ...entry.holeCards])
    return {
      id: entry.id,
      score: best.score,
      best: best.cards,
      description: describeHand(best.cards),
    }
  })

  let top = -1
  for (const result of scored) {
    if (result.score > top) top = result.score
  }

  return scored
    .map((result) => ({ ...result, isWinner: result.score === top }))
    .sort((a, b) => b.score - a.score)
}
