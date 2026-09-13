import { describe, expect, it } from 'vitest'
import { ev } from './events'
import { checkMoney } from './invariants'
import { money, ZERO } from './money'
import { reduce, replay } from './reducer'
import { playerId, type GameConfig, type GameState } from './types'

const RAJ = playerId('raj')
const AMIT = playerId('amit')
const VIKRAM = playerId('vikram')

const CONFIG: GameConfig = {
  initialBank: money(100_000),
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

describe('checkMoney', () => {
  it('is happy with a fresh game', () => {
    const report = checkMoney(game())

    expect(report.ok).toBe(true)
    expect(report.problems).toEqual([])
    expect(report.difference).toBe(ZERO)
    expect(report.bank).toBe(97_000)
    expect(report.stacks).toBe(3_000)
    expect(report.actual).toBe(report.expected)
  })

  it('counts chips that are out in the middle', () => {
    const report = checkMoney(reduce(game(), ev.handStarted(RAJ)))

    expect(report.ok).toBe(true)
    expect(report.pot).toBe(60)
    expect(report.stacks).toBe(2_940)
    expect(report.actual).toBe(100_000)
  })

  it('holds all the way through a hand', () => {
    let state = game()
    const events = [
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.raised(VIKRAM, money(400)),
      ev.folded(RAJ),
      ev.called(AMIT),
      ev.checked(AMIT),
      ev.checked(VIKRAM),
      ev.checked(AMIT),
      ev.checked(VIKRAM),
      ev.checked(AMIT),
      ev.checked(VIKRAM),
      ev.potAwarded([[VIKRAM]], true),
    ]

    for (const event of events) {
      state = reduce(state, event)
      expect(checkMoney(state).ok).toBe(true)
    }

    expect(checkMoney(state).actual).toBe(100_000)
  })

  it('notices money appearing from nowhere', () => {
    const healthy = game()
    // Hand-tamper a stack, the way a reducer bug would.
    const tampered: GameState = {
      ...healthy,
      players: healthy.players.map((p) => (p.id === RAJ ? { ...p, stack: money(1_500) } : p)),
    }

    const report = checkMoney(tampered)
    expect(report.ok).toBe(false)
    expect(report.difference).toBe(500)
    expect(report.problems[0]).toMatch(/more than it should/)
  })

  it('notices money vanishing', () => {
    const healthy = game()
    const tampered: GameState = {
      ...healthy,
      players: healthy.players.map((p) => (p.id === RAJ ? { ...p, stack: money(400) } : p)),
    }

    const report = checkMoney(tampered)
    expect(report.ok).toBe(false)
    expect(report.difference).toBe(-600)
  })

  it('flags a negative bank', () => {
    const healthy = game()
    const report = checkMoney({ ...healthy, bank: money(-10), totalIssued: money(2_990) })

    expect(report.ok).toBe(false)
    expect(report.problems.some((p) => /bank has gone negative/i.test(p))).toBe(true)
  })

  it('flags a bet-to-match that disagrees with the chips on the table', () => {
    const state = reduce(game(), ev.handStarted(RAJ))
    const broken: GameState = {
      ...state,
      hand: state.hand ? { ...state.hand, currentBet: money(200) } : null,
    }

    const report = checkMoney(broken)
    expect(report.ok).toBe(false)
    expect(report.problems.some((p) => /bet to match/i.test(p))).toBe(true)
  })
})
