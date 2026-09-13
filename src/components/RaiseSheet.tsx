import { useEffect, useMemo, useState } from 'react'
import type { LegalActions } from '../engine/betting'
import { formatMoney, money, parseMoney, type Money } from '../engine/money'
import type { Hand } from '../engine/types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { NumberInput } from '../ui/NumberInput'

interface RaiseSheetProps {
  readonly open: boolean
  readonly onClose: () => void
  readonly hand: Hand
  readonly legal: LegalActions
  readonly potTotal: Money
  readonly playerName: string
  readonly override: boolean
  readonly onConfirm: (toAmount: Money) => void
}

/**
 * Amount entry for a bet or a raise.
 *
 * Amounts are the *total* a player will have in for this round, which is how
 * poker is spoken ("raise to 300"), not the increment. The quick buttons cover
 * what people actually pick, so most of the time nobody types anything.
 */
export function RaiseSheet({
  open,
  onClose,
  hand,
  legal,
  potTotal,
  playerName,
  override,
  onConfirm,
}: RaiseSheetProps) {
  const opening = hand.currentBet === 0
  const floor: Money = override
    ? money(opening ? 1 : hand.currentBet + 1)
    : legal.minRaiseTo
  const ceiling = legal.maxRaiseTo

  /** What this player already has in front of them for this round. */
  const alreadyIn =
    hand.players.find((p) => p.playerId === legal.playerId)?.committedThisRound ?? money(0)

  const [text, setText] = useState('')

  // Start from the smallest legal amount each time it opens.
  useEffect(() => {
    if (open) setText(String(Math.min(floor, ceiling)))
  }, [open, floor, ceiling])

  const quick = useMemo(() => {
    const half = money(hand.currentBet + Math.floor(potTotal / 2))
    const full = money(hand.currentBet + potTotal)

    return [
      { label: opening ? 'Min' : 'Min raise', amount: floor },
      { label: '½ pot', amount: half },
      { label: 'Pot', amount: full },
      { label: 'All-in', amount: ceiling },
    ].filter(
      (option, index, all) =>
        option.amount >= floor &&
        option.amount <= ceiling &&
        // Drop duplicates, which happen on short stacks where everything
        // collapses onto the all-in number.
        all.findIndex((other) => other.amount === option.amount) === index,
    )
  }, [hand.currentBet, potTotal, floor, ceiling, opening])

  const parsed = parseMoney(text)
  const error =
    parsed === null
      ? 'Enter a whole number'
      : parsed < floor
        ? `At least ${formatMoney(floor)}`
        : parsed > ceiling
          ? `${playerName} only has ${formatMoney(ceiling)} to put in`
          : null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={opening ? `${playerName} bets` : `${playerName} raises`}
      footer={
        <Button
          variant="primary"
          size="lg"
          fullWidth
          disabled={error !== null || parsed === null}
          onClick={() => {
            if (parsed !== null && error === null) {
              onConfirm(parsed)
              onClose()
            }
          }}
        >
          {opening ? 'Bet' : 'Raise to'} {parsed !== null ? formatMoney(parsed) : '—'}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-2">
          {quick.map((option) => (
            <Button
              key={option.label}
              variant={parsed === option.amount ? 'primary' : 'default'}
              onClick={() => setText(String(option.amount))}
            >
              <span className="flex flex-col leading-tight">
                <span className="text-xs opacity-75">{option.label}</span>
                <span className="tnum">{formatMoney(option.amount)}</span>
              </span>
            </Button>
          ))}
        </div>

        <NumberInput
          label={opening ? 'Bet to' : 'Raise to'}
          value={text}
          onChange={setText}
          error={error}
          hint={`Between ${formatMoney(floor)} and ${formatMoney(ceiling)}`}
        />

        <dl className="tnum grid grid-cols-2 gap-y-1 text-xs text-faint">
          <dt>Pot right now</dt>
          <dd className="text-right">{formatMoney(potTotal)}</dd>
          {parsed !== null && error === null && (
            <>
              {/* The amount typed is the round total, so what actually leaves
                  the stack is that minus whatever is already in front of them. */}
              <dt>Leaving {playerName}&rsquo;s stack</dt>
              <dd className="text-right">{formatMoney(money(parsed - alreadyIn))}</dd>
              <dt>Stack after</dt>
              <dd className="text-right">{formatMoney(money(ceiling - parsed))}</dd>
            </>
          )}
        </dl>
      </div>
    </Modal>
  )
}
