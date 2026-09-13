import { describe, expect, it } from 'vitest'
import { ev, type GameEvent } from './events'
import { money, ZERO } from './money'
import { reduce, replay } from './reducer'
import { netResult, settle } from './settlement'
import { playerId, type GameConfig, type GameState } from './types'

const RAJ = playerId('raj')
const AMIT = playerId('amit')
const VIKRAM = playerId('vikram')

const CONFIG: GameConfig = {
  initialBank: money(10_000),
  boot: money(20),
  rake: ZERO,
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

function game(): GameState {
  return replay([
    ev.gameCreated(CONFIG, [
      { id: RAJ, name: 'Raj', buyIn: money(1_000) },
      { id: AMIT, name: 'Amit', buyIn: money(1_000) },
      { id: VIKRAM, name: 'Vikram', buyIn: money(1_000) },
    ]),
  ])
}

function run(state: GameState, ...events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, state)
}

/** One hand: Raj deals, the other two fold, Raj takes the boots. */
const FOLD_TO_RAJ: GameEvent[] = [
  ev.handStarted(RAJ),
  ev.folded(AMIT),
  ev.folded(VIKRAM),
  ev.potAwarded([[RAJ]], false),
]

describe('settling up', () => {
  it('is dead level before anyone has played', () => {
    const result = settle(game())

    expect(result.netSum).toBe(ZERO)
    expect(result.balances).toBe(true)
    expect(result.standings.every((s) => s.net === 0)).toBe(true)
  })

  it('shows who is up and who is down after a hand', () => {
    const result = settle(run(game(), ...FOLD_TO_RAJ))

    expect(result.standings[0]?.player.id).toBe(RAJ)
    expect(result.standings[0]?.net).toBe(40) // the two boots he collected
    expect(result.standings[1]?.net).toBe(-20)
    expect(result.standings[2]?.net).toBe(-20)
  })

  it('always comes to exactly zero, which is the proof it is right', () => {
    const result = settle(run(game(), ...FOLD_TO_RAJ, ...FOLD_TO_RAJ))

    expect(result.netSum).toBe(ZERO)
    expect(result.accountedFor).toBe(result.totalIssued)
    expect(result.balances).toBe(true)
  })

  it('counts a re-buy against the player rather than hiding it', () => {
    const state = run(game(), ...FOLD_TO_RAJ, ev.reBought(AMIT, money(500)))
    const amit = settle(state).standings.find((s) => s.player.id === AMIT)

    expect(amit?.tookFromBank).toBe(1_500)
    expect(amit?.finishedWith).toBe(1_480)
    expect(amit?.net).toBe(-20) // the re-buy itself changes nothing
    expect(settle(state).netSum).toBe(ZERO)
  })
})

describe('players who cashed out and left', () => {
  it('remembers what they walked away with', () => {
    // Raj is up 40 and leaves with 1,040.
    const state = run(game(), ...FOLD_TO_RAJ, ev.cashedOut(RAJ))
    const raj = state.players.find((p) => p.id === RAJ)

    expect(raj?.stack).toBe(ZERO)
    expect(raj?.totalReturnedToBank).toBe(1_040)
    expect(netResult(raj!)).toBe(40)
  })

  it('does not report a winner as having lost everything they took', () => {
    // This is the bug the totals would otherwise have: cashing out empties the
    // stack, so a naive stack-minus-buy-in reads as minus the whole buy-in.
    const state = run(game(), ...FOLD_TO_RAJ, ev.cashedOut(RAJ))
    const result = settle(state)
    const raj = result.standings.find((s) => s.player.id === RAJ)

    expect(raj?.net).toBe(40)
    expect(raj?.net).not.toBe(-1_000)
    expect(result.netSum).toBe(ZERO)
    expect(result.balances).toBe(true)
  })

  it('still balances when everyone has gone home', () => {
    const state = run(
      game(),
      ...FOLD_TO_RAJ,
      ev.cashedOut(RAJ),
      ev.cashedOut(AMIT),
      ev.cashedOut(VIKRAM),
    )
    const result = settle(state)

    expect(result.bank).toBe(10_000) // every chip back where it came from
    expect(result.netSum).toBe(ZERO)
    expect(result.balances).toBe(true)
  })
})

describe('mid-hand', () => {
  it('sets aside the pot rather than pretending it belongs to someone', () => {
    const state = run(game(), ev.handStarted(RAJ))
    const result = settle(state)

    expect(result.handInProgress).toBe(true)
    expect(result.potInPlay).toBe(60)
    // Nobody has won it yet, so the three players are collectively down by it.
    expect(result.netSum).toBe(-60)
    expect(result.accountedFor).toBe(result.totalIssued)
    expect(result.balances).toBe(true)
  })
})

describe('topping up the bank', () => {
  it('leaves the players level with each other', () => {
    const state = run(game(), ...FOLD_TO_RAJ, ev.bankToppedUp(money(5_000)))
    const result = settle(state)

    expect(result.totalIssued).toBe(15_000)
    expect(result.accountedFor).toBe(15_000)
    expect(result.netSum).toBe(ZERO)
    expect(result.balances).toBe(true)
  })
})

describe('ending the session', () => {
  it('blocks any further dealing', () => {
    const state = run(game(), ev.sessionEnded())

    expect(state.phase).toBe('ended')
    expect(() => reduce(state, ev.handStarted(RAJ))).toThrow(/not running/)
  })

  it('refuses to end in the middle of a hand', () => {
    const state = run(game(), ev.handStarted(RAJ))
    expect(() => reduce(state, ev.sessionEnded())).toThrow(/Finish or cancel the hand/)
  })
})
