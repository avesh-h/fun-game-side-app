import { describe, expect, it } from 'vitest'
import { potTotal } from './betting'
import { ev, type GameEvent } from './events'
import { add, money, sum, ZERO } from './money'
import { reduce, replay } from './reducer'
import { settle } from './settlement'
import { dealablePlayers, entryCost, playerId, type GameConfig, type GameState } from './types'

const RAJ = playerId('raj')
const AMIT = playerId('amit')
const VIKRAM = playerId('vikram')

/** Boot 20 into the pot, plus a 5 table charge back to the bank. */
const WITH_CHARGE: GameConfig = {
  initialBank: money(10_000),
  boot: money(20),
  rake: money(5),
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

function game(config: GameConfig = WITH_CHARGE, stacks = [1_000, 1_000, 1_000]): GameState {
  return replay([
    ev.gameCreated(config, [
      { id: RAJ, name: 'Raj', buyIn: money(stacks[0] ?? 0) },
      { id: AMIT, name: 'Amit', buyIn: money(stacks[1] ?? 0) },
      { id: VIKRAM, name: 'Vikram', buyIn: money(stacks[2] ?? 0) },
    ]),
  ])
}

function run(state: GameState, ...events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, state)
}

/** No money may appear or vanish, table charge or not. */
function expectBalanced(state: GameState) {
  const stacks = sum(state.players.map((p) => p.stack))
  const pot = state.hand ? potTotal(state.hand) : ZERO
  expect(add(state.bank, stacks, pot)).toBe(state.totalIssued)
}

const stackOf = (state: GameState, id = RAJ) =>
  state.players.find((p) => p.id === id)?.stack ?? ZERO

// ---------------------------------------------------------------------------

describe('collecting the table charge', () => {
  it('splits the entry between the pot and the bank', () => {
    const state = run(game(), ev.handStarted(RAJ))

    // Each player paid 25: twenty to the middle, five back to the bank.
    expect(stackOf(state, RAJ)).toBe(975)
    expect(potTotal(state.hand!)).toBe(60)
    expect(state.bank).toBe(7_000 + 15)
    expect(state.totalRaked).toBe(15)
    expectBalanced(state)
  })

  it('takes nothing when the charge is zero', () => {
    const state = run(game({ ...WITH_CHARGE, rake: ZERO }), ev.handStarted(RAJ))

    expect(stackOf(state, RAJ)).toBe(980)
    expect(state.totalRaked).toBe(ZERO)
    expect(state.bank).toBe(7_000)
    expectBalanced(state)
  })

  it('adds up across several hands', () => {
    let state = game()
    for (let i = 0; i < 3; i += 1) {
      const dealer = state.players[i % 3]!.id
      state = run(
        state,
        ev.handStarted(dealer),
        ...state.players
          .filter((p) => p.id !== dealer)
          .map((p) => ev.folded(p.id)),
      )
      state = run(state, ev.potAwarded([[dealer]], false))
    }

    expect(state.totalRaked).toBe(45) // 3 players x 5 x 3 hands
    expectBalanced(state)
  })

  it('records what each hand was charged', () => {
    let state = run(game(), ev.handStarted(RAJ), ev.folded(AMIT), ev.folded(VIKRAM))
    state = run(state, ev.potAwarded([[RAJ]], false))

    expect(state.history[0]?.raked).toBe(15)
    expect(state.history[0]?.totalPot).toBe(60)
  })

  it('gives the charge back when a hand is scrapped', () => {
    const before = game()
    const state = run(before, ev.handStarted(RAJ), ev.handCancelled())

    // A scrapped hand must cost nobody anything at all.
    expect(state.players.map((p) => p.stack)).toEqual([1_000, 1_000, 1_000])
    expect(state.bank).toBe(before.bank)
    expect(state.totalRaked).toBe(ZERO)
    expectBalanced(state)
  })
})

describe('players who cannot cover the entry', () => {
  it('counts the charge as part of what it costs to be dealt in', () => {
    expect(entryCost(WITH_CHARGE)).toBe(25)
  })

  it('holds back anyone short, rather than dealing them in', () => {
    // Amit has 24 — enough for the boot but not the charge on top.
    const state = game(WITH_CHARGE, [1_000, 24, 1_000])

    expect(dealablePlayers(state).map((p) => p.id)).toEqual([RAJ, VIKRAM])
  })

  it('lets them back in once they have borrowed enough', () => {
    let state = game(WITH_CHARGE, [1_000, 24, 1_000])
    expect(dealablePlayers(state)).toHaveLength(2)

    state = run(state, ev.reBought(AMIT, money(100)))
    expect(dealablePlayers(state)).toHaveLength(3)
    expectBalanced(state)
  })

  it('refuses to deal when the charge leaves fewer than two able to play', () => {
    const state = game(WITH_CHARGE, [1_000, 10, 10])
    expect(() => reduce(state, ev.handStarted(RAJ))).toThrow(/at least two players/)
  })
})

describe('the totals still balance', () => {
  it('accounts for the charge instead of the books going wrong', () => {
    let state = run(game(), ev.handStarted(RAJ), ev.folded(AMIT), ev.folded(VIKRAM))
    state = run(state, ev.potAwarded([[RAJ]], false))

    const result = settle(state)

    // Raj is up the two boots he collected, less his own charge.
    expect(result.standings[0]?.net).toBe(35)
    // The players are collectively down by exactly what the bank took.
    expect(result.netSum).toBe(-15)
    expect(result.totalRaked).toBe(15)
    expect(add(result.netSum, result.potInPlay, result.totalRaked)).toBe(ZERO)
    expect(result.balances).toBe(true)
  })

  it('still reports zero when no charge is set', () => {
    let state = run(
      game({ ...WITH_CHARGE, rake: ZERO }),
      ev.handStarted(RAJ),
      ev.folded(AMIT),
      ev.folded(VIKRAM),
    )
    state = run(state, ev.potAwarded([[RAJ]], false))

    const result = settle(state)
    expect(result.netSum).toBe(ZERO)
    expect(result.totalRaked).toBe(ZERO)
    expect(result.balances).toBe(true)
  })
})
