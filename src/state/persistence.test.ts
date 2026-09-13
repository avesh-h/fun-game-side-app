import { describe, expect, it } from 'vitest'
import { ev, type GameEvent } from '../engine/events'
import { money, ZERO } from '../engine/money'
import { replay } from '../engine/reducer'
import { playerId, type GameConfig } from '../engine/types'
import {
  clearSession,
  createMemoryStorage,
  isStorageAvailable,
  loadSession,
  SCHEMA_VERSION,
  saveSession,
} from './persistence'

const RAJ = playerId('raj')
const AMIT = playerId('amit')

const CONFIG: GameConfig = {
  initialBank: money(100_000),
  boot: money(20),
  rake: ZERO,
  minBet: money(20),
  defaultBuyIn: money(1_000),
}

const SESSION: GameEvent[] = [
  ev.gameCreated(CONFIG, [
    { id: RAJ, name: 'Raj', buyIn: money(1_000) },
    { id: AMIT, name: 'Amit', buyIn: money(1_000) },
  ]),
  ev.handStarted(RAJ),
  ev.bet(AMIT, money(100)),
]

describe('saving and loading', () => {
  it('brings a session back exactly as it was', () => {
    const storage = createMemoryStorage()
    saveSession(SESSION, storage)

    const loaded = loadSession(storage)
    expect(loaded).toEqual(SESSION)

    // And the point of it all: the same game comes back.
    expect(replay(loaded!)).toEqual(replay(SESSION))
  })

  it('returns nothing when there is nothing saved', () => {
    expect(loadSession(createMemoryStorage())).toBeNull()
  })

  it('clears the saved session', () => {
    const storage = createMemoryStorage()
    saveSession(SESSION, storage)
    clearSession(storage)

    expect(loadSession(storage)).toBeNull()
  })

  it('treats saving an empty log as clearing', () => {
    const storage = createMemoryStorage()
    saveSession(SESSION, storage)
    saveSession([], storage)

    expect(loadSession(storage)).toBeNull()
  })
})

describe('refusing to load anything broken', () => {
  it('ignores a session written by a different schema version', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'poker-ledger.session',
      JSON.stringify({ version: SCHEMA_VERSION + 1, savedAt: '', events: SESSION }),
    )

    expect(loadSession(storage)).toBeNull()
  })

  it('ignores unparseable data', () => {
    const storage = createMemoryStorage()
    storage.setItem('poker-ledger.session', '{ not json at all')

    expect(loadSession(storage)).toBeNull()
  })

  it('ignores events that do not rebuild into a real game', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'poker-ledger.session',
      JSON.stringify({
        version: SCHEMA_VERSION,
        savedAt: '',
        // One player is not a poker game — replaying this throws.
        events: [ev.gameCreated(CONFIG, [{ id: RAJ, name: 'Raj', buyIn: money(1_000) }])],
      }),
    )

    expect(loadSession(storage)).toBeNull()
  })

  it('ignores a payload whose events are not a list', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      'poker-ledger.session',
      JSON.stringify({ version: SCHEMA_VERSION, savedAt: '', events: 'nope' }),
    )

    expect(loadSession(storage)).toBeNull()
  })
})

describe('when storage is unavailable', () => {
  it('carries on without it instead of throwing', () => {
    expect(isStorageAvailable(null)).toBe(false)
    expect(() => saveSession(SESSION, null)).not.toThrow()
    expect(() => clearSession(null)).not.toThrow()
    expect(loadSession(null)).toBeNull()
  })
})
