import { useMemo, useState } from 'react'
import type { Card } from '../engine/cards'
import { resolveShowdown } from '../engine/handEval'
import type { PlayerId } from '../engine/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { CardChip, CardGrid } from './CardGrid'

const BOARD_SIZE = 5
const HOLE_CARDS = 2

export interface ComparePlayer {
  readonly id: PlayerId
  readonly name: string
}

/**
 * Optional tool for when the table cannot agree who won.
 *
 * Nothing here is required — the normal path is to read the cards yourself and
 * tap a name. This exists for the arguments that actually happen: two players
 * with the same pair, or a board that nobody is sure plays.
 *
 * Cards are entered once and the evaluator does the rest, including kickers,
 * which is exactly the part people get wrong by eye.
 */
export function CompareCards({
  open,
  onClose,
  players,
  onUse,
}: {
  readonly open: boolean
  readonly onClose: () => void
  readonly players: readonly ComparePlayer[]
  readonly onUse: (scoreById: ReadonlyMap<PlayerId, number>) => void
}) {
  const [board, setBoard] = useState<readonly Card[]>([])
  const [hands, setHands] = useState<Readonly<Record<string, readonly Card[]>>>({})

  const handOf = (id: PlayerId): readonly Card[] => hands[id] ?? []

  const used = useMemo(() => {
    const set = new Set<Card>(board)
    for (const cards of Object.values(hands)) for (const card of cards) set.add(card)
    return set
  }, [board, hands])

  /** Where the next tapped card lands: the board first, then each player. */
  const nextSlot = useMemo(() => {
    if (board.length < BOARD_SIZE) return { kind: 'board' as const }
    const waiting = players.find((p) => handOf(p.id).length < HOLE_CARDS)
    return waiting ? { kind: 'player' as const, id: waiting.id } : null
  }, [board, hands, players])

  const complete = nextSlot === null && players.length > 0

  const results = useMemo(() => {
    if (!complete) return []
    return resolveShowdown(
      board,
      players.map((p) => ({ id: p.id, holeCards: handOf(p.id) })),
    )
  }, [complete, board, hands, players])

  const place = (card: Card) => {
    if (!nextSlot) return
    if (nextSlot.kind === 'board') {
      setBoard((current) => [...current, card])
      return
    }
    setHands((current) => ({ ...current, [nextSlot.id]: [...(current[nextSlot.id] ?? []), card] }))
  }

  const removeFromBoard = (index: number) =>
    setBoard((current) => current.filter((_, i) => i !== index))

  const removeFromHand = (id: PlayerId, index: number) =>
    setHands((current) => ({
      ...current,
      [id]: (current[id] ?? []).filter((_, i) => i !== index),
    }))

  const reset = () => {
    setBoard([])
    setHands({})
  }

  const nameOf = (id: PlayerId) => players.find((p) => p.id === id)?.name ?? '?'

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title="Compare cards"
      footer={
        <div className="flex gap-2">
          <Button onClick={reset}>Clear</Button>
          <Button
            variant="primary"
            fullWidth
            disabled={!complete}
            onClick={() => {
              onUse(new Map(results.map((r) => [r.id, r.score])))
              reset()
              onClose()
            }}
          >
            {complete ? 'Use this result' : 'Enter every card'}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <p className="mb-1.5 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-faint">
            Shared cards
            {nextSlot?.kind === 'board' && <Badge tone="accent">Entering</Badge>}
          </p>
          <div className="flex gap-1.5">
            {Array.from({ length: BOARD_SIZE }, (_, i) => (
              <CardChip
                key={i}
                card={board[i]}
                active={nextSlot?.kind === 'board' && i === board.length}
                onClick={() => removeFromBoard(i)}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {players.map((player) => {
            const cards = handOf(player.id)
            const entering = nextSlot?.kind === 'player' && nextSlot.id === player.id
            const result = results.find((r) => r.id === player.id)

            return (
              <div
                key={player.id}
                className={[
                  'rounded-lg border px-3 py-2',
                  result?.isWinner ? 'border-good/50 bg-good/10' : 'border-line bg-surface',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm">
                    {player.name}
                    {entering && <Badge tone="accent">Entering</Badge>}
                    {result?.isWinner && <Badge tone="good">Wins</Badge>}
                  </span>
                  <div className="flex gap-1.5">
                    {Array.from({ length: HOLE_CARDS }, (_, i) => (
                      <CardChip
                        key={i}
                        card={cards[i]}
                        active={entering && i === cards.length}
                        onClick={() => removeFromHand(player.id, i)}
                      />
                    ))}
                  </div>
                </div>

                {result && (
                  <p className="mt-1 text-xs text-muted">{result.description}</p>
                )}
              </div>
            )
          })}
        </div>

        {complete && results.filter((r) => r.isWinner).length > 1 && (
          <p className="rounded-lg border border-good/30 bg-good/10 px-3 py-2 text-xs text-good">
            {results
              .filter((r) => r.isWinner)
              .map((r) => nameOf(r.id))
              .join(' and ')}{' '}
            have exactly the same hand. The pot splits.
          </p>
        )}

        {!complete && (
          <div>
            <p className="mb-2 text-xs text-faint">
              Tap cards in order. Tap a card you have already placed to take it back.
            </p>
            <CardGrid used={used} onPick={place} />
          </div>
        )}
      </div>
    </Modal>
  )
}
