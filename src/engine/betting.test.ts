import { describe, expect, it } from 'vitest'
import { legalActions, potTotal, RuleError, startHand } from './betting'
import { buildPots, contributionsOf, returnUncalledBet } from './pots'
import { ev, type GameEvent } from './events'
import { add, money, sum, ZERO, type Money } from './money'
import { reduce, replay } from './reducer'
import { clockwiseFromDealer, nextDealerId } from './seating'
import {
  playerId,
  playersShortOfEntry,
  type GameConfig,
  type GameState,
  type PlayerId,
} from './types'

const NAMES = ['raj', 'amit', 'vikram', 'sunny', 'dev'] as const
const [RAJ, AMIT, VIKRAM, SUNNY] = NAMES.map((n) => playerId(n)) as [
  PlayerId,
  PlayerId,
  PlayerId,
  PlayerId,
  PlayerId,
]

const CONFIG: GameConfig = {
  initialBank: money(100_000),
  boot: money(20),
  rake: ZERO,
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

function game(stacks: readonly number[], config: GameConfig = CONFIG): GameState {
  return replay([
    ev.gameCreated(
      config,
      stacks.map((buyIn, i) => ({
        id: playerId(NAMES[i] ?? `p${i}`),
        name: NAMES[i] ?? `P${i}`,
        buyIn: money(buyIn),
      })),
    ),
  ])
}

function run(state: GameState, ...events: readonly GameEvent[]): GameState {
  return events.reduce(reduce, state)
}

function stackOf(state: GameState, id: PlayerId): Money {
  return state.players.find((p) => p.id === id)?.stack ?? ZERO
}

/**
 * The invariant everything rests on: the bank plus every stack plus whatever
 * is in the middle always adds up to the money the bank ever issued.
 */
function expectBalanced(state: GameState) {
  const stacks = sum(state.players.map((p) => p.stack))
  const pot = state.hand ? potTotal(state.hand) : ZERO
  expect(add(state.bank, stacks, pot)).toBe(state.totalIssued)
}

// ---------------------------------------------------------------------------

describe('dealer rotation', () => {
  it('gives the marker to the first seat when nobody has dealt yet', () => {
    expect(nextDealerId(game([1000, 1000, 1000]))).toBe(RAJ)
  })

  it('moves one seat clockwise after a hand', () => {
    let state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))
    state = run(state, ev.folded(AMIT), ev.folded(VIKRAM), ev.potAwarded([[RAJ]], false))

    expect(state.lastDealerId).toBe(RAJ)
    expect(nextDealerId(state)).toBe(AMIT)
  })

  it('wraps back to the first seat after the last one', () => {
    const state = { ...game([1000, 1000, 1000]), lastDealerId: VIKRAM }
    expect(nextDealerId(state)).toBe(RAJ)
  })

  it('skips anyone who is sitting out', () => {
    const state = run(game([1000, 1000, 1000]), ev.satOut(AMIT))
    expect(nextDealerId(state)).toBe(RAJ)
    expect(nextDealerId({ ...state, lastDealerId: RAJ })).toBe(VIKRAM)
  })

  it('skips anyone with no chips left', () => {
    const broke = game([1000, 0, 1000])
    expect(nextDealerId({ ...broke, lastDealerId: RAJ })).toBe(VIKRAM)
  })

  /** Folds round until one player is left, then pays them, ending the hand. */
  function playHandOut(start: GameState): GameState {
    let state = start
    while (state.hand?.phase === 'betting') {
      const legal = legalActions(state)
      if (!legal) break
      state = reduce(state, ev.folded(legal.playerId))
    }

    const hand = state.hand
    if (!hand) return state
    const pots = buildPots(returnUncalledBet(contributionsOf(hand)).contributions)
    return reduce(
      state,
      ev.potAwarded(
        pots.map((pot) => [pot.eligible[0]!]),
        false,
      ),
    )
  }

  it('deals the button to everyone exactly equally over a full lap', () => {
    // The fairness claim in one test: acting last is an advantage, so it has to
    // come round to everybody the same number of times. A rotation guarantees
    // that exactly, where picking at random would only approach it.
    let state = game([1000, 1000, 1000, 1000, 1000])
    const dealt = new Map<PlayerId, number>()
    const wentFirst = new Map<PlayerId, number>()

    for (let hand = 0; hand < 20; hand += 1) {
      const dealer = nextDealerId(state)
      state = run(state, ev.handStarted(dealer))

      const first = state.hand?.toActId
      expect(first).not.toBeNull()

      dealt.set(dealer, (dealt.get(dealer) ?? 0) + 1)
      if (first) wentFirst.set(first, (wentFirst.get(first) ?? 0) + 1)

      state = playHandOut(state)
    }

    // Five players, twenty hands — four turns each, no more and no less.
    expect(state.history).toHaveLength(20)
    expect([...dealt.values()]).toEqual([4, 4, 4, 4, 4])
    expect([...wentFirst.values()]).toEqual([4, 4, 4, 4, 4])
    expect(dealt.size).toBe(5)
    expect(wentFirst.size).toBe(5)
  })

  it('shares it out evenly among whoever is still playing', () => {
    // Vikram steps away. The other three keep taking equal turns rather than
    // the rotation stalling or favouring somebody.
    let state = run(game([1000, 1000, 1000, 1000]), ev.satOut(VIKRAM))
    const dealt = new Map<PlayerId, number>()

    for (let hand = 0; hand < 9; hand += 1) {
      const dealer = nextDealerId(state)
      state = run(state, ev.handStarted(dealer))
      dealt.set(dealer, (dealt.get(dealer) ?? 0) + 1)
      state = playHandOut(state)
    }

    expect(dealt.get(VIKRAM)).toBeUndefined()
    expect([...dealt.values()]).toEqual([3, 3, 3])
  })
})

describe('starting a hand', () => {
  it('takes the boot from everyone and opens betting at zero', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))
    const hand = state.hand!

    expect(stackOf(state, RAJ)).toBe(980)
    expect(hand.players.every((p) => p.committedTotal === 20)).toBe(true)
    expect(potTotal(hand)).toBe(60)

    // The boot is dead money, not a bet to match, so the first player can check.
    expect(hand.currentBet).toBe(ZERO)
    expect(hand.players.every((p) => p.committedThisRound === ZERO)).toBe(true)
    expect(legalActions(state)?.canCheck).toBe(true)

    expectBalanced(state)
  })

  it('starts the action to the left of the dealer', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))
    expect(clockwiseFromDealer(state.hand!)).toEqual([AMIT, VIKRAM, RAJ])
    expect(state.hand?.toActId).toBe(AMIT)
  })

  it('holds back a player who cannot cover the entry rather than dealing them in short', () => {
    // House rule, chosen deliberately: the operator is asked whether they
    // borrow or sit out, instead of somebody being quietly put all-in before
    // seeing a card.
    const state = run(game([1000, 10, 1000]), ev.handStarted(RAJ))

    expect(state.hand?.players.map((p) => p.playerId)).toEqual([RAJ, VIKRAM])
    expect(stackOf(state, AMIT)).toBe(10) // untouched
    expect(potTotal(state.hand!)).toBe(40)
    expect(playersShortOfEntry({ ...state, hand: null }).map((p) => p.id)).toEqual([AMIT])
    expectBalanced(state)
  })

  it('deals in a player with exactly the entry, leaving them all-in', () => {
    const state = run(game([1000, 20, 1000]), ev.handStarted(RAJ))
    const short = state.hand?.players.find((p) => p.playerId === AMIT)

    expect(short?.status).toBe('allIn')
    expect(short?.committedTotal).toBe(20)
    expect(stackOf(state, AMIT)).toBe(ZERO)
    expectBalanced(state)
  })

  it('refuses to deal with fewer than two players holding chips', () => {
    expect(() => startHand(game([1000, 0, 0]), RAJ)).toThrow(RuleError)
  })

  it('goes straight to naming a winner if everyone is all-in on the boot', () => {
    const state = run(game([20, 20], { ...CONFIG, boot: money(20) }), ev.handStarted(RAJ))
    expect(state.hand?.phase).toBe('awaitingWinner')
    expect(state.hand?.toActId).toBeNull()
  })
})

describe('legal actions', () => {
  it('offers check or bet when nothing is out there', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))
    const legal = legalActions(state)!

    expect(legal.playerId).toBe(AMIT)
    expect(legal.canCheck).toBe(true)
    expect(legal.canBet).toBe(true)
    expect(legal.canCall).toBe(false)
    expect(legal.minRaiseTo).toBe(20) // the minimum bet
  })

  it('offers call or raise once there is a bet', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ), ev.bet(AMIT, money(100)))
    const legal = legalActions(state)!

    expect(legal.playerId).toBe(VIKRAM)
    expect(legal.canCheck).toBe(false)
    expect(legal.canCall).toBe(true)
    expect(legal.callAmount).toBe(100)
    expect(legal.canRaise).toBe(true)
    expect(legal.minRaiseTo).toBe(200) // raise by at least the 100 just bet
  })

  it('caps a call at the chips the player actually has', () => {
    const state = run(game([1000, 1000, 60]), ev.handStarted(RAJ), ev.bet(AMIT, money(500)))
    const legal = legalActions(state)!

    expect(legal.playerId).toBe(VIKRAM)
    expect(legal.callAmount).toBe(40) // 60 minus the 20 boot
    expect(legal.callIsAllIn).toBe(true)
    expect(legal.canRaise).toBe(false)
    expect(legal.raiseBlockedReason).toMatch(/Not enough chips/)
  })
})

describe('minimum bet and minimum raise', () => {
  it('refuses an opening bet below the minimum', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))
    expect(() => reduce(state, ev.bet(AMIT, money(5)))).toThrow(/Minimum bet/)
  })

  it('makes each raise at least as big as the one before it', () => {
    // Bet 20, raised to 60 — a lift of 40 — so the next raise must reach 100.
    const state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(20)),
      ev.raised(VIKRAM, money(60)),
    )

    expect(legalActions(state)?.minRaiseTo).toBe(100)
    expect(() => reduce(state, ev.raised(RAJ, money(90)))).toThrow(/Minimum raise/)
    expect(() => reduce(state, ev.raised(RAJ, money(100)))).not.toThrow()
  })

  it('always allows going all-in, even below a legal raise', () => {
    const state = run(
      game([1000, 1000, 150]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
    )

    // Vikram bought in for 150, so after the 20 boot he has 130 behind.
    const legal = legalActions(state)!
    expect(legal.canRaise).toBe(false) // 130 is short of the 200 needed
    expect(legal.canAllIn).toBe(true)
    expect(legal.allInTo).toBe(130)
  })
})

describe('a short all-in does not reopen the betting', () => {
  it('leaves a player who already acted with only call or fold', () => {
    // Amit bets 100. Vikram calls. Sunny bought in for 150 and has 130 left
    // after the boot, so shoving lifts the bet by only 30 — well short of the
    // 100 Amit bet, so it is not a real raise.
    const state = run(
      game([1000, 1000, 1000, 150]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.called(VIKRAM),
      ev.allIn(SUNNY),
    )

    expect(state.hand?.currentBet).toBe(130)
    expect(state.hand?.lastRaiseSize).toBe(100) // unchanged by the short shove

    const legal = legalActions(state)!
    expect(legal.playerId).toBe(RAJ)
    expect(legal.canCall).toBe(true)
    expect(legal.canRaise).toBe(true) // Raj has not acted yet this round

    // Amit, who already acted, gets no right to raise again.
    const backToAmit = run(state, ev.called(RAJ))
    const amitLegal = legalActions(backToAmit)!
    expect(amitLegal.playerId).toBe(AMIT)
    expect(amitLegal.canCall).toBe(true)
    expect(amitLegal.canRaise).toBe(false)
    expect(amitLegal.raiseBlockedReason).toMatch(/does not reopen/)
    expect(() => reduce(backToAmit, ev.raised(AMIT, money(400)))).toThrow(/not reopened/)
  })

  it('does give everyone another turn after a genuine raise', () => {
    const state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.raised(VIKRAM, money(300)),
    )

    expect(state.hand?.lastRaiseSize).toBe(200)
    const amit = state.hand?.players.find((p) => p.playerId === AMIT)
    expect(amit?.hasActedThisRound).toBe(false) // his turn came back
  })
})

describe('rounds', () => {
  it('moves to the next round once everyone has checked', () => {
    const state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.checked(AMIT),
      ev.checked(VIKRAM),
      ev.checked(RAJ),
    )

    expect(state.hand?.round).toBe('flop')
    expect(state.hand?.currentBet).toBe(ZERO)
    expect(state.hand?.toActId).toBe(AMIT) // action restarts left of the dealer
  })

  it('walks through all four rounds and then asks who won', () => {
    let state = run(game([1000, 1000]), ev.handStarted(RAJ))
    const seen: string[] = []

    for (let i = 0; i < 4; i += 1) {
      seen.push(state.hand!.round)
      state = run(state, ev.checked(AMIT), ev.checked(RAJ))
    }

    expect(seen).toEqual(['preflop', 'flop', 'turn', 'river'])
    expect(state.hand?.phase).toBe('awaitingWinner')
    expectBalanced(state)
  })

  it('clears each round bets into the pot before the next one', () => {
    const state = run(
      game([1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.called(RAJ),
    )

    expect(state.hand?.round).toBe('flop')
    expect(state.hand?.players.every((p) => p.committedThisRound === ZERO)).toBe(true)
    expect(potTotal(state.hand!)).toBe(240) // two boots plus 100 each
  })

  it('stops dealing rounds once nobody can bet any more', () => {
    // Both shove pre-flop, so the turn and river cannot change anything.
    const state = run(
      game([500, 500]),
      ev.handStarted(RAJ),
      ev.allIn(AMIT),
      ev.called(RAJ),
    )

    expect(state.hand?.phase).toBe('awaitingWinner')
    expect(state.hand?.round).toBe('preflop')
  })
})

describe('ending a hand', () => {
  it('stops as soon as everyone but one player folds', () => {
    const state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.folded(VIKRAM),
      ev.folded(RAJ),
    )

    expect(state.hand?.phase).toBe('awaitingWinner')
    expect(state.hand?.toActId).toBeNull()
  })

  it('returns the unmatched bet and pays the rest to the last player standing', () => {
    let state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.folded(VIKRAM),
      ev.folded(RAJ),
    )
    state = run(state, ev.potAwarded([[AMIT]], false))

    // Amit is up exactly the two boots the others left behind.
    expect(stackOf(state, AMIT)).toBe(1_040)
    expect(stackOf(state, RAJ)).toBe(980)
    expect(stackOf(state, VIKRAM)).toBe(980)
    expect(state.hand).toBeNull()
    expectBalanced(state)
  })

  it('records the hand for the history list', () => {
    let state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.folded(AMIT),
      ev.folded(VIKRAM),
    )
    state = run(state, ev.potAwarded([[RAJ]], false))

    const record = state.history[0]!
    expect(record.number).toBe(1)
    expect(record.boot).toBe(20)
    expect(record.totalPot).toBe(60)
    expect(record.awards).toEqual([{ playerId: RAJ, amount: 60 }])
    expect(record.wentToShowdown).toBe(false)
    expect(sum(record.contributions.map((c) => c.amount))).toBe(record.totalPot)
  })

  it('splits a pot that will not divide evenly, odd chip clockwise of the dealer', () => {
    let state = run(game([1000, 1000, 1000], { ...CONFIG, boot: money(25) }), ev.handStarted(RAJ))
    // Raj gets out; the other two check it down to the end.
    state = run(state, ev.checked(AMIT), ev.checked(VIKRAM), ev.folded(RAJ))
    for (let round = 0; round < 3; round += 1) {
      state = run(state, ev.checked(AMIT), ev.checked(VIKRAM))
    }

    expect(state.hand?.phase).toBe('awaitingWinner')
    state = run(state, ev.potAwarded([[AMIT, VIKRAM]], true))

    // 75 split two ways is 37 each with one over; Amit sits nearest the dealer.
    expect(stackOf(state, AMIT)).toBe(1_013)
    expect(stackOf(state, VIKRAM)).toBe(1_012)
    expectBalanced(state)
  })

  it('pays a side pot only to the players who could win it', () => {
    // Amit bought in for 200 and shoves it all pre-flop. Vikram and Raj both
    // have chips left, so betting carries on without him.
    let state = run(
      game([1000, 200, 1000]),
      ev.handStarted(RAJ),
      ev.allIn(AMIT),
      ev.called(VIKRAM),
      ev.raised(RAJ, money(500)),
      ev.called(VIKRAM),
    )

    expect(state.hand?.round).toBe('flop')
    for (let round = 0; round < 3; round += 1) {
      state = run(state, ev.checked(VIKRAM), ev.checked(RAJ))
    }
    expect(state.hand?.phase).toBe('awaitingWinner')

    // Amit takes the main pot; Vikram beats Raj for the side pot.
    state = run(state, ev.potAwarded([[AMIT], [VIKRAM]], true))

    expect(stackOf(state, AMIT)).toBe(600) // 200 x 3, the most he could win
    expect(stackOf(state, VIKRAM)).toBe(1_120) // 480 left plus the 640 side pot
    expect(stackOf(state, RAJ)).toBe(480)
    expectBalanced(state)
  })
})

describe('cancelling a hand', () => {
  it('gives every chip back and leaves the dealer marker where it was', () => {
    const before = game([1000, 1000, 1000])
    const state = run(
      before,
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(300)),
      ev.called(VIKRAM),
      ev.handCancelled(),
    )

    expect(state.players.map((p) => p.stack)).toEqual([1000, 1000, 1000])
    expect(state.hand).toBeNull()
    expect(state.lastDealerId).toBeNull() // same dealer deals again
    expect(state.history).toHaveLength(0)
    expectBalanced(state)
  })
})

describe('table stakes', () => {
  it('will not let a player top up mid-hand', () => {
    const state = run(game([1000, 1000]), ev.handStarted(RAJ))
    expect(() => reduce(state, ev.reBought(AMIT, money(500)))).toThrow(/while still in a hand/)
  })

  it('does allow a re-buy once the hand is over', () => {
    let state = run(game([1000, 1000]), ev.handStarted(RAJ), ev.folded(AMIT))
    state = run(state, ev.potAwarded([[RAJ]], false), ev.reBought(AMIT, money(500)))

    expect(stackOf(state, AMIT)).toBe(1_480)
    expectBalanced(state)
  })
})

describe('rules override', () => {
  it('lets the table agree a bet below the minimum', () => {
    const start = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))

    expect(() => reduce(start, ev.bet(AMIT, money(5)))).toThrow(/Minimum bet/)

    const state = run(start, ev.bet(AMIT, money(5), true))
    expect(state.hand?.currentBet).toBe(5)
    expect(stackOf(state, AMIT)).toBe(975)
    expectBalanced(state)
  })

  it('lets a raise be smaller than the one before it', () => {
    const start = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(20)),
      ev.raised(VIKRAM, money(60)),
    )

    expect(() => reduce(start, ev.raised(RAJ, money(70)))).toThrow(/Minimum raise/)
    expect(() => reduce(start, ev.raised(RAJ, money(70), true))).not.toThrow()
  })

  it('lets a player raise even when the betting was not reopened', () => {
    const state = run(
      game([1000, 1000, 1000, 150]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.called(VIKRAM),
      ev.allIn(SUNNY),
      ev.called(RAJ),
    )

    expect(() => reduce(state, ev.raised(AMIT, money(400)))).toThrow(/not reopened/)
    expect(() => reduce(state, ev.raised(AMIT, money(400), true))).not.toThrow()
  })

  it('still refuses to conjure chips that do not exist', () => {
    const state = run(game([1000, 1000, 1000]), ev.handStarted(RAJ))

    // Override waives sizing rules. It does not waive arithmetic.
    expect(() => reduce(state, ev.bet(AMIT, money(5_000), true))).toThrow(/more than your stack/)
    expect(() => reduce(state, ev.bet(AMIT, money(0), true))).toThrow(/more than nothing/)
  })

  it('still refuses a raise that is not actually a raise', () => {
    const state = run(
      game([1000, 1000, 1000]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
    )

    expect(() => reduce(state, ev.raised(VIKRAM, money(100), true))).toThrow(
      /must be more than the current bet/,
    )
  })

  it('records that an override was used, rather than hiding it', () => {
    expect(ev.bet(AMIT, money(5), true)).toMatchObject({ override: true })
    // A normal bet carries no flag at all, so old saved games stay readable.
    expect(ev.bet(AMIT, money(20))).not.toHaveProperty('override')
  })
})

describe('undo by replay', () => {
  it('lands on exactly the same state when the last event is dropped', () => {
    const events: GameEvent[] = [
      ev.gameCreated(CONFIG, [
        { id: RAJ, name: 'Raj', buyIn: money(1000) },
        { id: AMIT, name: 'Amit', buyIn: money(1000) },
        { id: VIKRAM, name: 'Vikram', buyIn: money(1000) },
      ]),
      ev.handStarted(RAJ),
      ev.bet(AMIT, money(100)),
      ev.called(VIKRAM),
    ]

    const full = replay(events)
    const undone = replay(events.slice(0, -1))
    const redone = reduce(undone, events[3]!)

    expect(undone.hand?.toActId).toBe(VIKRAM)
    expect(redone).toEqual(full)
  })
})
