import { describe, expect, it } from 'vitest'
import { potTotal } from './betting'
import { ev, type GameEvent } from './events'
import { add, money, sum, ZERO } from './money'
import { reduce, replay } from './reducer'
import { dealablePlayers, playerId, type GameConfig, type GameState } from './types'

const RAJ = playerId('raj')
const AMIT = playerId('amit')
const VIKRAM = playerId('vikram')
const DEV = playerId('dev')

const CONFIG: GameConfig = {
  initialBank: money(10_000),
  boot: money(20),
  rake: ZERO,
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

function game(config: GameConfig = CONFIG): GameState {
  return replay([
    ev.gameCreated(config, [
      { id: RAJ, name: 'Raj', buyIn: money(1_000) },
      { id: AMIT, name: 'Amit', buyIn: money(1_000) },
      { id: VIKRAM, name: 'Vikram', buyIn: money(1_000) },
    ]),
  ])
}

function run(state: GameState, ...events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, state)
}

function expectBalanced(state: GameState) {
  const stacks = sum(state.players.map((p) => p.stack))
  const pot = state.hand ? potTotal(state.hand) : ZERO
  expect(add(state.bank, stacks, pot)).toBe(state.totalIssued)
}

const find = (state: GameState, id = RAJ) => state.players.find((p) => p.id === id)

// ---------------------------------------------------------------------------

describe('re-buying', () => {
  it('moves money from the bank to the stack and remembers it', () => {
    const state = run(game(), ev.reBought(RAJ, money(500)))
    const raj = find(state)

    expect(raj?.stack).toBe(1_500)
    expect(raj?.totalTakenFromBank).toBe(1_500) // the original buy-in plus this
    expect(state.bank).toBe(6_500)
    expectBalanced(state)
  })

  it('refuses to hand out more than the bank holds', () => {
    const state = game()
    expect(state.bank).toBe(7_000)
    expect(() => reduce(state, ev.reBought(RAJ, money(7_001)))).toThrow(/overdraw/)
  })

  it('refuses a re-buy of nothing', () => {
    expect(() => reduce(game(), ev.reBought(RAJ, money(0)))).toThrow(/more than nothing/)
  })

  it('refuses to top up a player who has cashed out', () => {
    const state = run(game(), ev.cashedOut(RAJ))
    expect(() => reduce(state, ev.reBought(RAJ, money(500)))).toThrow(/already cashed out/)
  })
})

describe('cashing out', () => {
  it('sends the stack back to the bank and stops them being dealt in', () => {
    const state = run(game(), ev.cashedOut(AMIT))
    const amit = find(state, AMIT)

    expect(amit?.stack).toBe(ZERO)
    expect(amit?.status).toBe('left')
    expect(state.bank).toBe(8_000)
    expect(dealablePlayers(state).map((p) => p.id)).toEqual([RAJ, VIKRAM])
    expectBalanced(state)
  })

  it('keeps them on the books so the night totals still show them', () => {
    const state = run(game(), ev.cashedOut(AMIT))
    // Still present, still carrying what they took — just no longer playing.
    expect(find(state, AMIT)?.totalTakenFromBank).toBe(1_000)
  })

  it('cannot be done twice', () => {
    const state = run(game(), ev.cashedOut(AMIT))
    expect(() => reduce(state, ev.cashedOut(AMIT))).toThrow(/already cashed out/)
  })
})

describe('sitting out', () => {
  it('takes them out of the deal and puts them back', () => {
    let state = run(game(), ev.satOut(VIKRAM))
    expect(find(state, VIKRAM)?.status).toBe('sittingOut')
    expect(dealablePlayers(state).map((p) => p.id)).toEqual([RAJ, AMIT])

    state = run(state, ev.satIn(VIKRAM))
    expect(find(state, VIKRAM)?.status).toBe('active')
    expect(dealablePlayers(state)).toHaveLength(3)
  })

  it('leaves their chips exactly where they are', () => {
    const state = run(game(), ev.satOut(VIKRAM))
    expect(find(state, VIKRAM)?.stack).toBe(1_000)
    expectBalanced(state)
  })

  it('will not sit out somebody already sitting out', () => {
    const state = run(game(), ev.satOut(VIKRAM))
    expect(() => reduce(state, ev.satOut(VIKRAM))).toThrow(/not currently playing/)
  })
})

describe('adding a player mid-session', () => {
  it('seats them behind everyone else', () => {
    const state = run(
      game(),
      ev.playerAdded({ id: DEV, name: 'Dev', buyIn: money(800) }),
    )
    const dev = find(state, DEV)

    expect(dev?.seat).toBe(3)
    expect(dev?.stack).toBe(800)
    expect(dev?.totalTakenFromBank).toBe(800)
    expect(state.bank).toBe(6_200)
    expectBalanced(state)
  })

  it('refuses a duplicate id', () => {
    expect(() =>
      reduce(game(), ev.playerAdded({ id: RAJ, name: 'Raj again', buyIn: money(500) })),
    ).toThrow(/already seated/)
  })

  it('refuses when the bank cannot cover the buy-in', () => {
    expect(() =>
      reduce(game(), ev.playerAdded({ id: DEV, name: 'Dev', buyIn: money(99_999) })),
    ).toThrow(/overdraw/)
  })
})

describe('topping up the bank', () => {
  it('creates money and says so in the total issued', () => {
    const state = run(game(), ev.bankToppedUp(money(5_000)))

    expect(state.bank).toBe(12_000)
    // The invariant tracks the new total rather than being broken by it.
    expect(state.totalIssued).toBe(15_000)
    expectBalanced(state)
  })

  it('lets a dry bank keep the game going', () => {
    // A small bank, fully lent out.
    let state = game({ ...CONFIG, initialBank: money(3_000) })
    expect(state.bank).toBe(ZERO)
    expect(() => reduce(state, ev.reBought(RAJ, money(100)))).toThrow(/overdraw/)

    state = run(state, ev.bankToppedUp(money(2_000)), ev.reBought(RAJ, money(100)))
    expect(state.bank).toBe(1_900)
    expectBalanced(state)
  })

  it('refuses a top-up of nothing', () => {
    expect(() => reduce(game(), ev.bankToppedUp(money(0)))).toThrow(/more than nothing/)
  })
})

describe('starting a session', () => {
  it('refuses to let players take more than the bank holds', () => {
    expect(() =>
      replay([
        ev.gameCreated({ ...CONFIG, initialBank: money(100) }, [
          { id: RAJ, name: 'Raj', buyIn: money(1_000) },
          { id: AMIT, name: 'Amit', buyIn: money(1_000) },
        ]),
      ]),
    ).toThrow(/more than the bank holds/)
  })

  it('refuses a one-player game', () => {
    expect(() =>
      replay([ev.gameCreated(CONFIG, [{ id: RAJ, name: 'Raj', buyIn: money(100) }])]),
    ).toThrow(/at least two players/)
  })
})
