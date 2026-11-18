import { describe, expect, it } from 'vitest'
import { createMemoryStorage } from '../state/persistence'
import { loadActiveGame, saveActiveGame } from './activeGame'

describe('active game', () => {
  it('defaults to the menu', () => {
    expect(loadActiveGame(createMemoryStorage())).toBe('menu')
    expect(loadActiveGame(null)).toBe('menu')
  })

  it('remembers the chosen game', () => {
    const storage = createMemoryStorage()
    saveActiveGame('undercover', storage)
    expect(loadActiveGame(storage)).toBe('undercover')
  })

  it('ignores anything it does not recognise', () => {
    const storage = createMemoryStorage()
    storage.setItem('game-night.active-game', 'chess')
    expect(loadActiveGame(storage)).toBe('menu')
  })
})
