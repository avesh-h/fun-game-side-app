import { CardFace } from '../components/CardGrid'
import { cardOf, SUITS, type Card } from '../engine/cards'
import { Panel, PanelTitle } from '../ui/Panel'

/**
 * The settle-an-argument screen.
 *
 * Rankings strongest first, each with the example hand people picture, plus
 * what the five actions actually mean. Deliberately plain — someone reaches
 * for this mid-hand with three people waiting.
 */

const RANK_VALUES: Readonly<Record<string, number>> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  T: 10, J: 11, Q: 12, K: 13, A: 14,
}

function card(text: string): Card {
  const rank = RANK_VALUES[text.slice(0, -1)] ?? 2
  const suit = SUITS.indexOf(text.slice(-1) as (typeof SUITS)[number])
  return cardOf(rank, suit === -1 ? 0 : suit)
}

const hand = (text: string): Card[] => text.split(' ').map(card)

const RANKINGS: readonly {
  readonly name: string
  readonly cards: readonly Card[]
  readonly note: string
}[] = [
  { name: 'Royal flush', cards: hand('Ad Kd Qd Jd Td'), note: 'Ten to ace, all one suit' },
  { name: 'Straight flush', cards: hand('Js Ts 9s 8s 7s'), note: 'Five in a row, all one suit' },
  { name: 'Four of a kind', cards: hand('9h 9c 9d 9s Kh'), note: 'All four of the same rank' },
  { name: 'Full house', cards: hand('Ah Ac Ad 3s 3h'), note: 'Three of one, two of another' },
  { name: 'Flush', cards: hand('Kc Tc 8c 7c 5c'), note: 'Any five of one suit' },
  { name: 'Straight', cards: hand('Th 9c 8d 7h 6s'), note: 'Five in a row, suits mixed' },
  { name: 'Three of a kind', cards: hand('7h 7d 7c Qs 3h'), note: 'Three of the same rank' },
  { name: 'Two pair', cards: hand('Jh Jc 5d 5s 7h'), note: 'Two different pairs' },
  { name: 'Pair', cards: hand('Ah Ac Kd Jc 7h'), note: 'Two of the same rank' },
  { name: 'High card', cards: hand('Kh 8c Qd 2s 7h'), note: 'Nothing at all — highest card plays' },
]

const ACTIONS: readonly { readonly name: string; readonly meaning: string }[] = [
  {
    name: 'Check',
    meaning: 'Pass. Pay nothing and stay in. Only allowed when nobody has bet this round.',
  },
  { name: 'Call', meaning: 'Match the current bet to stay in the hand.' },
  {
    name: 'Bet / Raise',
    meaning: 'Put in more than the current bet. Everyone else must match it or fold.',
  },
  { name: 'Fold', meaning: 'Give up the hand. Anything already put in stays in the pot.' },
  {
    name: 'All-in',
    meaning:
      'Push your whole stack in. You can only win the part of the pot you paid into — the rest becomes a side pot for the others.',
  },
]

export function Guide() {
  return (
    // Rankings are long and the written explanations are short, so on a wide
    // screen they sit side by side rather than one enormous scroll.
    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:gap-4">
      <Panel padded={false} className="lg:w-1/2 lg:shrink-0">
        <div className="px-4 pt-4">
          <PanelTitle>Hands, strongest first</PanelTitle>
        </div>

        <ol className="flex flex-col">
          {RANKINGS.map((ranking, index) => (
            <li
              key={ranking.name}
              className="flex items-center gap-3 border-t border-line-soft px-4 py-2.5 first:border-t-0"
            >
              <span className="tnum w-4 shrink-0 text-xs text-faint">{index + 1}</span>

              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{ranking.name}</span>
                <span className="block text-xs text-faint">{ranking.note}</span>
              </span>

              <span className="flex shrink-0 gap-0.5">
                {ranking.cards.map((c) => (
                  <CardFace key={c} card={c} />
                ))}
              </span>
            </li>
          ))}
        </ol>
      </Panel>

      <div className="flex flex-col gap-3 lg:w-1/2">
      <Panel>
        <PanelTitle>How a hand runs</PanelTitle>
        <ul className="flex flex-col gap-2.5 text-xs text-muted">
          <li>
            <strong className="text-ink">You never choose who acts.</strong> The app goes
            round the table in order and moves on by itself after each tap. Whoever is up
            next is the highlighted row marked <em>their turn</em>, and their name is in
            large text above the buttons.
          </li>
          <li>
            <strong className="text-ink">The small D is the dealer marker</strong>, not a
            selection. It only decides who speaks first, and it moves one seat every hand so
            nobody is always last. The player to the dealer&rsquo;s left acts first in every
            round.
          </li>
          <li>
            <strong className="text-ink">Everybody pays the boot first</strong>, then betting
            goes round up to four times — pre-flop, flop, turn, river. A round ends once
            everyone still in has matched the same amount.
          </li>
          <li>
            <strong className="text-ink">Tapped the wrong thing?</strong> Undo takes back the
            last tap, as many times as you need, right back to the start of the hand.
          </li>
        </ul>
      </Panel>

      <Panel>
        <PanelTitle>What each move means</PanelTitle>
        <dl className="flex flex-col gap-2.5">
          {ACTIONS.map((action) => (
            <div key={action.name}>
              <dt className="text-sm font-medium">{action.name}</dt>
              <dd className="text-xs text-muted">{action.meaning}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      <Panel>
        <PanelTitle>Two rules people get wrong</PanelTitle>
        <ul className="flex flex-col gap-2.5 text-xs text-muted">
          <li>
            <strong className="text-ink">A-2-3-4-5 is a straight</strong> — the lowest one. The
            ace counts low there and high everywhere else. Q-K-A-2-3 is <em>not</em> a straight;
            rankings do not wrap around.
          </li>
          <li>
            <strong className="text-ink">Kickers decide level hands.</strong> Two players with
            the same pair are separated by their remaining cards, in order. Exactly five cards
            count — a sixth never breaks a tie. If all five are identical, the pot splits.
          </li>
        </ul>
      </Panel>

      <p className="text-xs text-faint">
        Cannot agree? Use <strong className="text-muted">Compare cards</strong> on the winner
        screen — enter everyone&rsquo;s cards and the app works it out, kickers included.
      </p>
      </div>
    </div>
  )
}
