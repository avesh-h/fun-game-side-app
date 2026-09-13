import {
  cardOf,
  HIGHEST_RANK,
  LOWEST_RANK,
  RANK_SYMBOLS,
  rankOf,
  RED_SUITS,
  SUIT_SYMBOLS,
  suitOf,
  type Card,
} from '../engine/cards'

/**
 * The whole deck, one row per rank, four suits across.
 *
 * Thirteen columns would be about 26px wide on a phone, which is not a
 * reliable tap target with people waiting. Turning the grid on its side gives
 * every card a proper button and lets the list scroll, which is natural inside
 * a sheet anyway.
 *
 * Cards already placed somewhere else are disabled rather than hidden, so the
 * same card physically cannot be entered twice — the most common way card
 * entry goes wrong.
 */
export function CardGrid({
  used,
  onPick,
}: {
  readonly used: ReadonlySet<Card>
  readonly onPick: (card: Card) => void
}) {
  const ranks: number[] = []
  for (let rank = HIGHEST_RANK; rank >= LOWEST_RANK; rank -= 1) ranks.push(rank)

  return (
    <div className="flex flex-col gap-1">
      {ranks.map((rank) => (
        <div key={rank} className="flex items-center gap-1">
          <span className="tnum w-6 shrink-0 text-right text-xs font-semibold text-faint">
            {RANK_SYMBOLS[rank]}
          </span>

          {[0, 1, 2, 3].map((suit) => {
            const card = cardOf(rank, suit)
            const taken = used.has(card)
            const red = RED_SUITS.includes(suit)

            return (
              <button
                key={suit}
                type="button"
                disabled={taken}
                aria-label={`${RANK_SYMBOLS[rank]} ${SUIT_SYMBOLS[suit]}`}
                onClick={() => onPick(card)}
                className={[
                  'flex min-h-10 flex-1 items-center justify-center gap-0.5 rounded-md border text-sm',
                  taken
                    ? 'border-line-soft bg-transparent text-faint opacity-30'
                    : 'border-line bg-raised enabled:hover:border-accent/50 enabled:hover:bg-line active:bg-line',
                  !taken && red ? 'text-suit-red' : '',
                  !taken && !red ? 'text-suit-black' : '',
                ].join(' ')}
              >
                <span className="tnum">{RANK_SYMBOLS[rank]}</span>
                <span>{SUIT_SYMBOLS[suit]}</span>
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}

/** A card you cannot tap — used for the examples in the guide. */
export function CardFace({ card }: { readonly card: Card }) {
  const red = RED_SUITS.includes(suitOf(card))
  return (
    <span
      className={[
        'flex h-7 w-8 shrink-0 items-center justify-center gap-px rounded border border-line bg-raised text-[0.6875rem]',
        red ? 'text-suit-red' : 'text-suit-black',
      ].join(' ')}
    >
      <span className="tnum">{RANK_SYMBOLS[rankOf(card)]}</span>
      <span>{SUIT_SYMBOLS[suitOf(card)]}</span>
    </span>
  )
}

/** A single placed card, or an empty slot waiting to be filled. */
export function CardChip({
  card,
  active,
  onClick,
}: {
  readonly card: Card | undefined
  readonly active?: boolean
  readonly onClick?: () => void
}) {
  if (card === undefined) {
    return (
      <span
        className={[
          'flex h-9 w-11 items-center justify-center rounded-md border border-dashed text-xs',
          active ? 'border-accent text-accent' : 'border-line text-faint',
        ].join(' ')}
      >
        {active ? '·' : ''}
      </span>
    )
  }

  const red = RED_SUITS.includes(card & 3)

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Remove ${RANK_SYMBOLS[2 + (card >> 2)]}`}
      className={[
        'flex h-9 w-11 items-center justify-center gap-0.5 rounded-md border border-line bg-raised text-sm',
        red ? 'text-suit-red' : 'text-suit-black',
      ].join(' ')}
    >
      <span className="tnum">{RANK_SYMBOLS[2 + (card >> 2)]}</span>
      <span>{SUIT_SYMBOLS[card & 3]}</span>
    </button>
  )
}
