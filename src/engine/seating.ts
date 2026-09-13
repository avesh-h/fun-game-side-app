/**
 * Seating and turn order.
 *
 * There are no blinds in this game — everyone pays the same boot — so the
 * dealer marker carries no money. It exists for two reasons only: to decide
 * who speaks first, and to break ties when an odd chip will not divide.
 *
 * It still has to rotate. Without it the same person would act last every
 * single hand, which is a real positional advantage.
 */

import { dealablePlayers, type GameState, type Hand, type Player, type PlayerId } from './types'

/** Everyone at the table, in clockwise seating order. */
export function bySeat(players: readonly Player[]): readonly Player[] {
  return [...players].sort((a, b) => a.seat - b.seat)
}

/**
 * Who deals the next hand.
 *
 * Moves one seat clockwise from whoever dealt last, skipping anyone who cannot
 * be dealt in. If the previous dealer has since left or sat out, their seat is
 * still the reference point, so the rotation does not jump backwards.
 */
export function nextDealerId(state: GameState): PlayerId {
  const pool = bySeat(dealablePlayers(state))
  const first = pool[0]
  if (!first) throw new Error('Nobody can be dealt in')

  const previous = state.lastDealerId
    ? state.players.find((p) => p.id === state.lastDealerId)
    : undefined
  if (!previous) return first.id

  return (pool.find((p) => p.seat > previous.seat) ?? first).id
}

/**
 * Everyone in the hand, starting immediately clockwise of the dealer.
 *
 * This is both the speaking order and the order odd chips are handed out in.
 */
export function clockwiseFromDealer(hand: Hand): readonly PlayerId[] {
  const ids = hand.players.map((p) => p.playerId)
  const dealerIndex = ids.indexOf(hand.dealerId)
  if (dealerIndex === -1) return ids
  return [...ids.slice(dealerIndex + 1), ...ids.slice(0, dealerIndex + 1)]
}

/** First player who can still act, starting left of the dealer. */
export function firstToActId(hand: Hand): PlayerId | null {
  for (const id of clockwiseFromDealer(hand)) {
    const player = hand.players.find((p) => p.playerId === id)
    if (player?.status === 'in') return id
  }
  return null
}

/** Next player who can still act, continuing clockwise past `afterId`. */
export function nextToActId(hand: Hand, afterId: PlayerId): PlayerId | null {
  const ids = hand.players.map((p) => p.playerId)
  const start = ids.indexOf(afterId)
  if (start === -1) return firstToActId(hand)

  for (let step = 1; step <= ids.length; step += 1) {
    const id = ids[(start + step) % ids.length]
    if (id === undefined) continue
    const player = hand.players.find((p) => p.playerId === id)
    if (player?.status === 'in') return id
  }
  return null
}
