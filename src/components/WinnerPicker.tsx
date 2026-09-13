import { useEffect, useMemo, useState } from 'react'
import { formatMoney, money, type Money } from '../engine/money'
import {
  awardPots,
  bestEligiblePerPot,
  buildPots,
  contributionsOf,
  mergeAwards,
  returnUncalledBet,
} from '../engine/pots'
import { clockwiseFromDealer } from '../engine/seating'
import { contestingPlayers, type GameState, type Hand, type PlayerId } from '../engine/types'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { CompareCards } from './CompareCards'

export function WinnerPicker({
  state,
  hand,
  onAward,
}: {
  readonly state: GameState
  readonly hand: Hand
  readonly onAward: (winnersByPot: readonly (readonly PlayerId[])[], wentToShowdown: boolean) => void
}) {
  const [winners, setWinners] = useState<Readonly<Record<number, readonly PlayerId[]>>>({})
  const [compareOpen, setCompareOpen] = useState(false)

  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?'
  const stackOf = (id: PlayerId): Money =>
    state.players.find((p) => p.id === id)?.stack ?? money(0)

  // Exactly what the reducer will do, so the preview below cannot be wrong.
  const { contributions, refund } = useMemo(
    () => returnUncalledBet(contributionsOf(hand)),
    [hand],
  )
  const pots = useMemo(() => buildPots(contributions), [contributions])

  const contesting = contestingPlayers(hand)
  const wentToShowdown = contesting.length > 1

  // A pot with only one player able to win it has already answered the
  // question — most often because everyone else folded. Choosing it for them
  // turns a two-tap chore into one.
  useEffect(() => {
    const decided: Record<number, readonly PlayerId[]> = {}
    for (const pot of pots) {
      const only = pot.eligible.length === 1 ? pot.eligible[0] : undefined
      if (only) decided[pot.index] = [only]
    }
    if (Object.keys(decided).length > 0) {
      setWinners((current) => ({ ...decided, ...current }))
    }
  }, [pots])

  const everyPotDecided = pots.every((pot) => (winners[pot.index] ?? []).length > 0)

  const preview = useMemo(() => {
    if (!everyPotDecided) return null
    try {
      const awards = awardPots(
        pots,
        pots.map((pot) => winners[pot.index] ?? []),
        clockwiseFromDealer(hand),
      )
      return mergeAwards([
        ...(refund ? [{ playerId: refund.playerId, amount: refund.amount }] : []),
        ...awards,
      ])
    } catch {
      return null
    }
  }, [everyPotDecided, pots, winners, hand, refund])

  const toggle = (potIndex: number, id: PlayerId) =>
    setWinners((current) => {
      const picked = current[potIndex] ?? []
      return {
        ...current,
        [potIndex]: picked.includes(id) ? picked.filter((p) => p !== id) : [...picked, id],
      }
    })

  return (
    // An accent border because this is the only thing on screen that needs
    // doing, and on a wide layout it sits away from where the eye has been.
    <Panel className="flex flex-col gap-4 border-accent/50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold">
            {wentToShowdown ? 'Betting is finished' : 'Everyone else folded'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            {wentToShowdown
              ? 'Turn the cards over and look at them. Tap whoever has the best hand, then confirm below.'
              : 'Only one player is left, so the pot is already theirs. Just confirm below.'}
          </p>
        </div>

        {wentToShowdown && (
          <Button size="sm" onClick={() => setCompareOpen(true)}>
            Compare cards
          </Button>
        )}
      </div>

      {refund && (
        <p className="text-xs text-faint">
          {nameOf(refund.playerId)} gets back{' '}
          <span className="tnum">{formatMoney(refund.amount)}</span> that nobody covered.
        </p>
      )}

      {pots.map((pot) => {
        const picked = winners[pot.index] ?? []
        return (
          <div key={pot.index} className="flex flex-col gap-2">
            <span className="text-xs text-faint">
              {pots.length === 1 ? 'Pot' : pot.index === 0 ? 'Main pot' : `Side pot ${pot.index}`} ·{' '}
              <span className="tnum">{formatMoney(pot.amount)}</span>
              {picked.length > 1 && <span className="text-good"> · splitting</span>}
            </span>

            <div className="grid grid-cols-2 gap-2">
              {pot.eligible.map((id) => {
                const chosen = picked.includes(id)
                return (
                  <Button
                    key={id}
                    variant={chosen ? 'primary' : 'default'}
                    onClick={() => toggle(pot.index, id)}
                  >
                    {chosen && <span aria-hidden>✓</span>}
                    {nameOf(id)}
                  </Button>
                )
              })}
            </div>
          </div>
        )
      })}

      {wentToShowdown && (
        <p className="text-xs text-faint">
          Same hand? Tap both names and the pot splits between them.
        </p>
      )}

      {preview && (
        <div className="rounded-lg border border-line-soft bg-raised px-3 py-2">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-faint">
            Before you confirm
          </p>
          <ul className="flex flex-col gap-1">
            {preview.map((award) => (
              <li key={award.playerId} className="flex items-baseline justify-between text-sm">
                <span>{nameOf(award.playerId)}</span>
                <span className="tnum flex items-baseline gap-2">
                  <span className="text-good">+{formatMoney(award.amount)}</span>
                  <span className="text-faint">
                    → {formatMoney(money(stackOf(award.playerId) + award.amount))}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        disabled={!everyPotDecided}
        onClick={() => {
          onAward(
            pots.map((pot) => winners[pot.index] ?? []),
            wentToShowdown,
          )
          setWinners({})
        }}
      >
        {everyPotDecided
          ? 'Award pot'
          : pots.length > 1
            ? 'Tap a winner for each pot above'
            : 'Tap a name above first'}
      </Button>

      <CompareCards
        open={compareOpen}
        onClose={() => setCompareOpen(false)}
        players={contesting.map((p) => ({ id: p.playerId, name: nameOf(p.playerId) }))}
        onUse={(scoreById) => {
          const decided = bestEligiblePerPot(pots, scoreById)
          setWinners(Object.fromEntries(decided.map((ids, index) => [index, ids])))
        }}
      />
    </Panel>
  )
}
