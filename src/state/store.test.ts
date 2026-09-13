import { describe, expect, it } from 'vitest'
import { ev, type GameEvent } from '../engine/events'
import { money, ZERO } from '../engine/money'
import { replay } from '../engine/reducer'
import { playerId, type GameConfig } from '../engine/types'
import { lastHandStartIndex } from './store'

const RAJ = playerId('raj')
const AMIT = playerId('amit')

const CONFIG: GameConfig = {
  initialBank: money(10_000),
  boot: money(20),
  rake: ZERO,
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

const CREATED = ev.gameCreated(CONFIG, [
  { id: RAJ, name: 'Raj', buyIn: money(1_000) },
  { id: AMIT, name: 'Amit', buyIn: money(1_000) },
])

/** One complete hand: dealt, folded, paid out. */
function hand(dealer = RAJ, folder = AMIT): GameEvent[] {
  return [
    ev.handStarted(dealer),
    ev.folded(folder),
    ev.potAwarded([[dealer === RAJ ? RAJ : AMIT]], false),
  ]
}

describe('finding the last hand', () => {
  it('is absent before any hand is dealt', () => {
    expect(lastHandStartIndex([CREATED])).toBe(-1)
  })

  it('points at the most recent deal, not the first', () => {
    const events = [CREATED, ...hand(), ...hand(AMIT, RAJ)]
    expect(lastHandStartIndex(events)).toBe(4)
    expect(events[4]?.type).toBe('HandStarted')
  })

  it('finds a hand still in progress', () => {
    const events = [CREATED, ...hand(), ev.handStarted(AMIT), ev.folded(RAJ)]
    expect(lastHandStartIndex(events)).toBe(4)
  })
})

describe('scrapping the last hand', () => {
  it('rewinds to exactly the state before it was dealt', () => {
    const beforeSecond = [CREATED, ...hand()]
    const afterSecond = [...beforeSecond, ...hand(AMIT, RAJ)]

    const rewound = afterSecond.slice(0, lastHandStartIndex(afterSecond))

    expect(rewound).toEqual(beforeSecond)
    expect(replay(rewound)).toEqual(replay(beforeSecond))
    expect(replay(rewound).history).toHaveLength(1)
  })

  it('takes anything that happened since the deal with it', () => {
    // A re-buy after the hand was paid out is part of "since", so it goes too.
    const events = [CREATED, ...hand(), ev.reBought(AMIT, money(500))]
    const rewound = events.slice(0, lastHandStartIndex(events))

    expect(replay(rewound).history).toHaveLength(0)
    expect(replay(rewound).players.find((p) => p.id === AMIT)?.stack).toBe(1_000)
  })
})
