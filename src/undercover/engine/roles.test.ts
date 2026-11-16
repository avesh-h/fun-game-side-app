import { describe, expect, it } from 'vitest'
import { assignRoles, autoDistribute, buildTurnOrder, minimumPlayers, validateDistribution } from './roles'
import type { RoleConfig, UcPlayer } from './types'
import { ucPlayerId } from './types'

function makePlayers(n: number): UcPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: ucPlayerId(`p${i}`),
    name: `Player ${i + 1}`,
  }))
}

describe('autoDistribute', () => {
  it('returns at least 1 infiltrator for any valid config', () => {
    for (let n = 3; n <= 20; n++) {
      const uc = autoDistribute(n, true, false)
      expect(uc.undercovers).toBeGreaterThanOrEqual(1)
      expect(uc.civilians + uc.undercovers).toBe(n)

      const mw = autoDistribute(n, false, true)
      expect(mw.mrWhites).toBeGreaterThanOrEqual(1)
      expect(mw.civilians + mw.mrWhites).toBe(n)

      if (n >= 4) {
        const both = autoDistribute(n, true, true)
        expect(both.undercovers).toBeGreaterThanOrEqual(1)
        expect(both.mrWhites).toBeGreaterThanOrEqual(1)
        expect(both.civilians + both.undercovers + both.mrWhites).toBe(n)
      }
    }
  })

  it('civilians always outnumber infiltrators', () => {
    for (let n = 3; n <= 20; n++) {
      for (const [uc, mw] of [[true, false], [false, true], [true, true]] as const) {
        if (n < 5 && uc && mw) continue
        const counts = autoDistribute(n, uc, mw)
        expect(counts.civilians).toBeGreaterThan(counts.undercovers + counts.mrWhites)
      }
    }
  })

  it('throws if no infiltrator role enabled', () => {
    expect(() => autoDistribute(5, false, false)).toThrow()
  })
})

describe('validateDistribution', () => {
  it('accepts valid distributions', () => {
    expect(validateDistribution(5, { civilians: 4, undercovers: 1, mrWhites: 0 })).toBeNull()
    expect(validateDistribution(6, { civilians: 4, undercovers: 1, mrWhites: 1 })).toBeNull()
  })

  it('rejects when total does not match', () => {
    expect(validateDistribution(5, { civilians: 4, undercovers: 2, mrWhites: 0 })).not.toBeNull()
  })

  it('rejects zero civilians', () => {
    expect(validateDistribution(3, { civilians: 0, undercovers: 2, mrWhites: 1 })).not.toBeNull()
  })

  it('rejects zero infiltrators', () => {
    expect(validateDistribution(5, { civilians: 5, undercovers: 0, mrWhites: 0 })).not.toBeNull()
  })

  it('rejects when civilians do not outnumber infiltrators', () => {
    expect(validateDistribution(4, { civilians: 2, undercovers: 2, mrWhites: 0 })).not.toBeNull()
  })
})

describe('assignRoles', () => {
  it('assigns the correct number of each role', () => {
    const players = makePlayers(6)
    const counts = { civilians: 4, undercovers: 1, mrWhites: 1 }
    const result = assignRoles(players, counts, 'Coffee', 'Tea')

    const civs = result.filter((r) => r.role === 'civilian')
    const ucs = result.filter((r) => r.role === 'undercover')
    const mws = result.filter((r) => r.role === 'mrWhite')

    expect(civs).toHaveLength(4)
    expect(ucs).toHaveLength(1)
    expect(mws).toHaveLength(1)
  })

  it('gives civilians the civilian word', () => {
    const players = makePlayers(4)
    const result = assignRoles(players, { civilians: 3, undercovers: 1, mrWhites: 0 }, 'Cat', 'Dog')
    const civs = result.filter((r) => r.role === 'civilian')
    for (const c of civs) expect(c.word).toBe('Cat')
  })

  it('gives undercovers the undercover word', () => {
    const players = makePlayers(4)
    const result = assignRoles(players, { civilians: 3, undercovers: 1, mrWhites: 0 }, 'Cat', 'Dog')
    const ucs = result.filter((r) => r.role === 'undercover')
    for (const u of ucs) expect(u.word).toBe('Dog')
  })

  it('gives Mr. White no word', () => {
    const players = makePlayers(4)
    const result = assignRoles(players, { civilians: 3, undercovers: 0, mrWhites: 1 }, 'Cat', 'Dog')
    const mws = result.filter((r) => r.role === 'mrWhite')
    for (const m of mws) expect(m.word).toBeNull()
  })

  it('preserves player ids', () => {
    const players = makePlayers(5)
    const result = assignRoles(players, { civilians: 4, undercovers: 1, mrWhites: 0 }, 'A', 'B')
    for (let i = 0; i < players.length; i++) {
      expect(result[i]!.id).toBe(players[i]!.id)
    }
  })
})

describe('buildTurnOrder', () => {
  it('includes only alive players', () => {
    const players = makePlayers(5)
    const rps = assignRoles(players, { civilians: 4, undercovers: 1, mrWhites: 0 }, 'A', 'B')
    const withDead = rps.map((p, i) => (i === 2 ? { ...p, alive: false } : p))
    const order = buildTurnOrder(withDead)
    expect(order).toHaveLength(4)
    expect(order).not.toContain(players[2]!.id)
  })
})

describe('minimumPlayers', () => {
  it('returns 5 when both roles enabled', () => {
    const config: RoleConfig = { useUndercover: true, useMrWhite: true, undercoverCount: 1, mrWhiteCount: 1, autoDistribute: true }
    expect(minimumPlayers(config)).toBe(5)
  })

  it('returns 3 when only one role enabled', () => {
    expect(minimumPlayers({ useUndercover: true, useMrWhite: false, undercoverCount: 1, mrWhiteCount: 0, autoDistribute: true })).toBe(3)
    expect(minimumPlayers({ useUndercover: false, useMrWhite: true, undercoverCount: 0, mrWhiteCount: 1, autoDistribute: true })).toBe(3)
  })
})
