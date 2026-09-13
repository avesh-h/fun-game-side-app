import { useEffect, useRef } from 'react'
import { formatMoney } from '../engine/money'
import type { HandPlayer, Player } from '../engine/types'
import { Badge } from '../ui/Badge'

export function PlayerRow({
  player,
  inHand,
  isDealer,
  isToAct,
}: {
  readonly player: Player
  readonly inHand: HandPlayer | undefined
  readonly isDealer: boolean
  readonly isToAct: boolean
}) {
  const folded = inHand?.status === 'folded'
  const allIn = inHand?.status === 'allIn'
  const broke = player.stack === 0 && !allIn
  const row = useRef<HTMLLIElement>(null)

  // At a full table the row whose turn it is can sit below the fold. `nearest`
  // only moves the page when it actually needs to, so nothing jumps around
  // when the row is already visible.
  useEffect(() => {
    if (isToAct) row.current?.scrollIntoView({ block: 'nearest' })
  }, [isToAct])

  return (
    <li
      ref={row}
      className={[
        'flex items-center justify-between gap-2 rounded-lg border px-3 py-3 text-sm',
        // The row being acted on gets a thick left edge as well as a tint, so
        // it reads as "this one" at a glance and cannot be mistaken for the
        // dealer marker sitting quietly on some other row.
        isToAct
          ? 'border-accent border-l-4 bg-accent-soft font-medium'
          : 'border-line border-l-4 border-l-transparent bg-surface',
        folded ? 'opacity-45' : '',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-2">
        {/* A fixed slot for the dealer marker, so names stay aligned down the
            column whether or not the row has one. */}
        <span
          className="w-4 shrink-0 text-center text-[0.6875rem] font-semibold text-faint"
          title={isDealer ? 'Deals this hand — decides who acts first' : undefined}
        >
          {isDealer ? 'D' : ''}
        </span>

        <span className={`truncate ${folded ? 'line-through' : ''}`}>{player.name}</span>

        {isToAct && <Badge tone="accent">Their turn</Badge>}
        {allIn && <Badge tone="warn">All-in</Badge>}
        {folded && <Badge tone="quiet">Folded</Badge>}
        {player.status === 'sittingOut' && <Badge tone="quiet">Sitting out</Badge>}
        {broke && !inHand && <Badge tone="bad">Broke</Badge>}
      </span>

      <span className="flex shrink-0 items-baseline gap-3">
        {inHand && inHand.committedThisRound > 0 && (
          <span className="tnum rounded-md bg-raised px-1.5 py-0.5 text-xs text-muted">
            {formatMoney(inHand.committedThisRound)}
          </span>
        )}
        <span className={`tnum tabular-nums ${player.stack === 0 ? 'text-faint' : ''}`}>
          {formatMoney(player.stack)}
        </span>
      </span>
    </li>
  )
}
