import { potTotal } from '../engine/betting'
import { formatMoney } from '../engine/money'
import { buildPots, contributionsOf, returnUncalledBet } from '../engine/pots'
import {
  BETTING_ROUNDS,
  ROUND_LABELS,
  type GameState,
  type Hand,
  type PlayerId,
} from '../engine/types'

/**
 * The pot, and the side pots once somebody is all-in.
 *
 * The breakdown only appears when it means something. With nobody all-in there
 * is one pot and showing "main pot" would be noise; the moment a short stack is
 * in the middle, who can win what stops being obvious and is worth spelling out.
 */
export function PotDisplay({ state, hand }: { readonly state: GameState; readonly hand: Hand }) {
  const total = potTotal(hand)
  const anyAllIn = hand.players.some((p) => p.status === 'allIn')

  // An unmatched bet is only unmatched once betting has finished. While players
  // are still to act it might yet be called, so returning it early would make
  // the layers add up to less than the pot shown above them.
  const contributions =
    hand.phase === 'awaitingWinner'
      ? returnUncalledBet(contributionsOf(hand)).contributions
      : contributionsOf(hand)

  const pots = anyAllIn ? buildPots(contributions) : []
  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?'

  /** Nobody has acted yet — the moment the turn order needs explaining. */
  const freshHand =
    hand.round === 'preflop' && hand.players.every((p) => !p.hasActedThisRound)

  // Naming everyone is useful for a short list and unreadable for a long one.
  const describeEligible = (ids: readonly PlayerId[]): string =>
    ids.length > 4 ? `${ids.length} players` : ids.map(nameOf).join(', ')

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-accent">
            {ROUND_LABELS[hand.round]}
          </p>
          {/* "Flop" means nothing to somebody new; "round 2 of 4" always does. */}
          <p className="mt-0.5 text-xs text-faint">
            Round {BETTING_ROUNDS.indexOf(hand.round) + 1} of 4 · Hand {hand.number}
          </p>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-wider text-faint">Pot</p>
          <p className="tnum text-3xl font-semibold leading-tight lg:text-4xl">
            {formatMoney(total)}
          </p>
        </div>
      </div>

      {hand.phase === 'awaitingWinner' ? (
        // The betting controls have gone, so without this the screen just looks
        // stalled. Say what is being waited on, and where.
        <p className="mt-2 border-t border-line-soft pt-2 text-xs text-accent">
          Betting is finished — say who won it
          <span className="lg:hidden"> below</span>
          <span className="hidden lg:inline"> on the right</span>.
        </p>
      ) : freshHand && hand.toActId ? (
        // The deal moving one seat means a different person starts every hand.
        // That reads as the app picking someone at random unless it is said out
        // loud, so it is said out loud — once, at the top of each hand.
        <p className="mt-2 border-t border-line-soft pt-2 text-xs leading-relaxed text-faint">
          <strong className="font-medium text-muted">{nameOf(hand.dealerId)}</strong> deals this
          hand, so <strong className="font-medium text-muted">{nameOf(hand.toActId)}</strong> goes
          first. The deal moves one seat every hand, so nobody is always last.
        </p>
      ) : (
        hand.currentBet > 0 && (
          <p className="mt-2 border-t border-line-soft pt-2 text-xs text-muted">
            <span className="tnum">{formatMoney(hand.currentBet)}</span> to match
          </p>
        )
      )}

      {pots.length > 1 && (
        <ul className="mt-2 flex flex-col gap-1 border-t border-line-soft pt-2">
          {pots.map((pot) => (
            <li key={pot.index} className="flex items-baseline justify-between gap-3 text-xs">
              <span className="min-w-0 truncate text-faint">
                {pot.index === 0 ? 'Main' : `Side ${pot.index}`}
                <span className="opacity-70"> · {describeEligible(pot.eligible)}</span>
              </span>
              <span className="tnum shrink-0 text-muted">{formatMoney(pot.amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
