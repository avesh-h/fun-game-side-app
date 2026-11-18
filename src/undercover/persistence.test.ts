import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../state/persistence'
import { confirmWordSeen, INITIAL_STATE, revealWord, startRound } from './engine/machine'
import { DEFAULT_SCORING, ucPlayerId, type UcPlayer } from './engine/types'
import { clearUcSession, loadUcSession, saveUcSession, UC_SCHEMA_VERSION } from './persistence'

const PLAYERS: UcPlayer[] = ['A', 'B', 'C', 'D'].map((name, i) => ({
  id: ucPlayerId(`p${i}`),
  name,
}))

function roundInProgress() {
  return startRound(INITIAL_STATE, PLAYERS, 'anonymous', INITIAL_STATE.roleConfig, DEFAULT_SCORING)
}

describe('undercover persistence', () => {
  it('round-trips a game in progress along with its undo history', () => {
    const storage = createMemoryStorage()
    const first = roundInProgress()
    const second = confirmWordSeen(first)

    saveUcSession({ state: second, history: [first] }, storage)
    const loaded = loadUcSession(storage)

    expect(loaded?.state).toEqual(second)
    expect(loaded?.history).toEqual([first])
  })

  it('hides a word that was on screen when the app closed', () => {
    const storage = createMemoryStorage()
    const shown = revealWord(roundInProgress())

    saveUcSession({ state: shown, history: [shown] }, storage)
    const loaded = loadUcSession(storage)

    expect(loaded?.state.phaseState).toMatchObject({ phase: 'wordReveal', revealed: false })
    expect(loaded?.history[0]?.phaseState).toMatchObject({ revealed: false })
  })

  it('does not keep an untouched setup screen', () => {
    const storage = createMemoryStorage()
    saveUcSession({ state: roundInProgress(), history: [] }, storage)
    saveUcSession({ state: INITIAL_STATE, history: [] }, storage)
    expect(loadUcSession(storage)).toBeNull()
  })

  it('discards corrupt data, other versions and wrong shapes', () => {
    const storage = createMemoryStorage()

    storage.setItem('undercover.session', '{not json')
    expect(loadUcSession(storage)).toBeNull()

    storage.setItem(
      'undercover.session',
      JSON.stringify({ version: UC_SCHEMA_VERSION + 1, state: roundInProgress(), history: [] }),
    )
    expect(loadUcSession(storage)).toBeNull()

    storage.setItem(
      'undercover.session',
      JSON.stringify({ version: UC_SCHEMA_VERSION, state: { phaseState: { phase: 'nope' } }, history: [] }),
    )
    expect(loadUcSession(storage)).toBeNull()
  })

  it('clears', () => {
    const storage = createMemoryStorage()
    saveUcSession({ state: roundInProgress(), history: [] }, storage)
    clearUcSession(storage)
    expect(loadUcSession(storage)).toBeNull()
  })

  it('does nothing when storage is unavailable', () => {
    expect(() => saveUcSession({ state: roundInProgress(), history: [] }, null)).not.toThrow()
    expect(loadUcSession(null)).toBeNull()
  })
})
