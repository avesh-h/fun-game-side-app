/**
 * Cards.
 *
 * The app never deals or displays a hand of its own — you deal real cards.
 * These exist purely so the optional "compare cards" tool can be told what is
 * on the table and work out who wins.
 *
 * A card is a single integer 0-51, packed as `(rank - 2) * 4 + suit`. Integers
 * rather than objects because the correctness test scores all 2,598,960
 * possible five-card hands, and that is 13 million card reads.
 */

export type Card = number

export const SUITS = ['c', 'd', 'h', 's'] as const
export type SuitIndex = 0 | 1 | 2 | 3

export const SUIT_SYMBOLS = ['♣', '♦', '♥', '♠'] as const // club diamond heart spade
export const SUIT_NAMES = ['Clubs', 'Diamonds', 'Hearts', 'Spades'] as const

/** Red suits are diamonds and hearts — used to colour the card grid. */
export const RED_SUITS: readonly number[] = [1, 2]

export const LOWEST_RANK = 2
export const HIGHEST_RANK = 14 // ace
export const DECK_SIZE = 52

export const RANK_SYMBOLS: Readonly<Record<number, string>> = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
}

const RANK_WORD: Readonly<Record<number, string>> = {
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'jack',
  12: 'queen',
  13: 'king',
  14: 'ace',
}

// ---------------------------------------------------------------------------

export function cardOf(rank: number, suit: number): Card {
  if (!Number.isInteger(rank) || rank < LOWEST_RANK || rank > HIGHEST_RANK) {
    throw new Error(`Bad card rank: ${rank}`)
  }
  if (!Number.isInteger(suit) || suit < 0 || suit > 3) {
    throw new Error(`Bad card suit: ${suit}`)
  }
  return (rank - 2) * 4 + suit
}

export function rankOf(card: Card): number {
  return 2 + (card >> 2)
}

export function suitOf(card: Card): number {
  return card & 3
}

/** Every card in the deck, ordered for the tap grid: all clubs, all diamonds... */
export function fullDeck(): Card[] {
  const deck: Card[] = []
  for (let i = 0; i < DECK_SIZE; i += 1) deck.push(i)
  return deck
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/** Compact label for a chip-sized card, e.g. "A♠". */
export function cardLabel(card: Card): string {
  return `${RANK_SYMBOLS[rankOf(card)] ?? '?'}${SUIT_SYMBOLS[suitOf(card)] ?? '?'}`
}

/** Spoken form, e.g. "Ace of Spades". Used for screen readers. */
export function cardName(card: Card): string {
  const rank = RANK_WORD[rankOf(card)] ?? '?'
  const suit = SUIT_NAMES[suitOf(card)] ?? '?'
  return `${rank.charAt(0).toUpperCase()}${rank.slice(1)} of ${suit}`
}

/** "ace" / "aces" — for naming a made hand in plain English. */
export function rankWord(rank: number, plural = false): string {
  const word = RANK_WORD[rank] ?? '?'
  if (!plural) return word
  return word === 'six' ? 'sixes' : `${word}s`
}
