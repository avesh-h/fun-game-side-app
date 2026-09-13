import { describe, expect, it } from 'vitest'
import { defaultDraft, validateSetup, type SetupDraft } from './setupModel'

function draft(overrides: Partial<SetupDraft> = {}): SetupDraft {
  const base = defaultDraft(['a', 'b'])
  return {
    ...base,
    players: [
      { key: 'a', name: 'Raj', buyIn: '1000' },
      { key: 'b', name: 'Amit', buyIn: '1000' },
    ],
    ...overrides,
  }
}

describe('a well-formed setup', () => {
  it('produces a game ready to start', () => {
    const result = validateSetup(draft())

    expect(result.hasErrors).toBe(false)
    expect(result.ready).not.toBeNull()
    expect(result.ready?.config).toEqual({
      initialBank: 100_000,
      boot: 20,
      rake: 0,
      minBet: 20,
      defaultBuyIn: 1_000,
    })
    expect(result.ready?.players).toEqual([
      { id: 'a', name: 'Raj', buyIn: 1_000 },
      { id: 'b', name: 'Amit', buyIn: 1_000 },
    ])
  })

  it('reports what is on the table and what is left', () => {
    const result = validateSetup(draft())
    expect(result.totalBuyIn).toBe(2_000)
    expect(result.bankRemaining).toBe(98_000)
  })

  it('trims stray spaces from names', () => {
    const result = validateSetup(
      draft({ players: [
        { key: 'a', name: '  Raj  ', buyIn: '1000' },
        { key: 'b', name: 'Amit', buyIn: '1000' },
      ] }),
    )
    expect(result.ready?.players[0]?.name).toBe('Raj')
  })
})

describe('players', () => {
  it('needs at least two', () => {
    const result = validateSetup(
      draft({ players: [{ key: 'a', name: 'Raj', buyIn: '1000' }] }),
    )
    expect(result.errors.players).toMatch(/at least two/)
    expect(result.ready).toBeNull()
  })

  it('requires a name', () => {
    const result = validateSetup(
      draft({ players: [
        { key: 'a', name: '', buyIn: '1000' },
        { key: 'b', name: 'Amit', buyIn: '1000' },
      ] }),
    )
    expect(result.errors.byPlayer['a']).toMatch(/name/i)
    expect(result.ready).toBeNull()
  })

  it('refuses two players with the same name', () => {
    // Names are how players are told apart on every screen.
    const result = validateSetup(
      draft({ players: [
        { key: 'a', name: 'Raj', buyIn: '1000' },
        { key: 'b', name: 'raj', buyIn: '1000' },
      ] }),
    )
    expect(result.errors.byPlayer['a']).toMatch(/share a name/)
    expect(result.errors.byPlayer['b']).toMatch(/share a name/)
  })

  it('requires a starting amount above zero', () => {
    const result = validateSetup(
      draft({ players: [
        { key: 'a', name: 'Raj', buyIn: '0' },
        { key: 'b', name: 'Amit', buyIn: '1000' },
      ] }),
    )
    expect(result.errors.byPlayer['a']).toBeDefined()
    expect(result.ready).toBeNull()
  })
})

describe('the bank', () => {
  it('refuses to hand out more than it holds', () => {
    const result = validateSetup(draft({ bank: '1500' }))

    expect(result.errors.bank).toMatch(/only holds/)
    expect(result.bankRemaining).toBe(-500)
    expect(result.ready).toBeNull()
  })

  it('is fine when it exactly covers everyone', () => {
    const result = validateSetup(draft({ bank: '2000' }))

    expect(result.errors.bank).toBeUndefined()
    expect(result.bankRemaining).toBe(0)
    expect(result.ready).not.toBeNull()
  })
})

describe('amounts that are not amounts', () => {
  it('rejects blanks and rubbish', () => {
    expect(validateSetup(draft({ bank: '' })).errors.bank).toBeDefined()
    expect(validateSetup(draft({ boot: '' })).errors.boot).toBeDefined()
    expect(validateSetup(draft({ minBet: '' })).errors.minBet).toBeDefined()
    expect(validateSetup(draft({ defaultBuyIn: '' })).errors.defaultBuyIn).toBeDefined()
  })

  it('rejects zero', () => {
    expect(validateSetup(draft({ boot: '0' })).errors.boot).toMatch(/more than zero/)
  })
})

describe('the table charge', () => {
  it('is off by default and costs nothing', () => {
    const result = validateSetup(draft())

    expect(result.ready?.config.rake).toBe(0)
    expect(result.entryCost).toBe(20) // the boot alone
  })

  it('adds to what it costs to be dealt in', () => {
    const result = validateSetup(draft({ rake: '5' }))

    expect(result.ready?.config.rake).toBe(5)
    expect(result.entryCost).toBe(25)
  })

  it('treats a blank as none', () => {
    const result = validateSetup(draft({ rake: '' }))

    expect(result.errors.rake).toBeUndefined()
    expect(result.ready?.config.rake).toBe(0)
  })
})

describe('players who could not afford to play', () => {
  it('refuses a starting stack below the boot', () => {
    const result = validateSetup(
      draft({
        boot: '50',
        minBet: '50',
        players: [
          { key: 'a', name: 'Raj', buyIn: '10' },
          { key: 'b', name: 'Amit', buyIn: '1000' },
        ],
      }),
    )

    // Below the entry they could not play a single hand, so it is an error
    // rather than something to warn about and allow.
    expect(result.errors.byPlayer['a']).toMatch(/at least 50/)
    expect(result.ready).toBeNull()
  })

  it('counts the table charge when deciding that', () => {
    const result = validateSetup(
      draft({
        boot: '20',
        rake: '5',
        players: [
          { key: 'a', name: 'Raj', buyIn: '22' },
          { key: 'b', name: 'Amit', buyIn: '1000' },
        ],
      }),
    )

    // 22 covers the boot but not the boot plus the charge.
    expect(result.errors.byPlayer['a']).toMatch(/at least 25.*boot 20 \+ charge 5/)
    expect(result.ready).toBeNull()
  })

  it('warns, but allows, a stack good for only one hand', () => {
    const result = validateSetup(
      draft({
        boot: '20',
        players: [
          { key: 'a', name: 'Raj', buyIn: '25' },
          { key: 'b', name: 'Amit', buyIn: '1000' },
        ],
      }),
    )

    expect(result.warnings[0]).toMatch(/Raj can only afford one hand/)
    expect(result.hasErrors).toBe(false)
    expect(result.ready).not.toBeNull()
  })
})
