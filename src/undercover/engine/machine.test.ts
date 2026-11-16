import { describe, expect, it } from 'vitest'
import {
  castVote,
  confirmWordSeen,
  eliminatePlayer,
  INITIAL_STATE,
  mrWhiteGuess,
  newSession,
  nextDescription,
  playAgain,
  proceedAfterElimination,
  readyToVote,
  revealWord,
  scrapRound,
  scrapRoundToSetup,
  skipMrWhiteGuess,
  skipToVoting,
  startRound,
} from './machine'
import type { RoleConfig, UcGameState, UcPlayer, VotingMode } from './types'
import { ucPlayerId } from './types'

function makePlayers(n: number): UcPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: ucPlayerId(`p${i}`),
    name: `Player ${i + 1}`,
  }))
}

const DEFAULT_CONFIG: RoleConfig = {
  useUndercover: true,
  useMrWhite: false,
  undercoverCount: 1,
  mrWhiteCount: 0,
  autoDistribute: true,
}

const MR_WHITE_CONFIG: RoleConfig = {
  useUndercover: false,
  useMrWhite: true,
  undercoverCount: 0,
  mrWhiteCount: 1,
  autoDistribute: true,
}

function startGame(
  playerCount = 5,
  config = DEFAULT_CONFIG,
  votingMode: VotingMode = 'anonymous',
): UcGameState {
  return startRound(INITIAL_STATE, makePlayers(playerCount), votingMode, config)
}

function passWordReveal(state: UcGameState): UcGameState {
  let s = state
  for (let i = 0; i < state.roundPlayers.length; i++) {
    s = revealWord(s)
    s = confirmWordSeen(s)
  }
  return s
}

function passDescriptions(state: UcGameState): UcGameState {
  let s = state
  const alive = state.roundPlayers.filter((p) => p.alive)
  for (let i = 0; i < alive.length; i++) {
    s = nextDescription(s)
  }
  return s
}

describe('startRound', () => {
  it('transitions to wordReveal phase', () => {
    const state = startGame()
    expect(state.phaseState.phase).toBe('wordReveal')
  })

  it('assigns a word pair', () => {
    const state = startGame()
    expect(state.wordPair).not.toBeNull()
    expect(state.wordPair!.civilian).toBeTruthy()
    expect(state.wordPair!.undercover).toBeTruthy()
  })

  it('assigns roles to all players', () => {
    const state = startGame()
    expect(state.roundPlayers).toHaveLength(5)
    const civs = state.roundPlayers.filter((p) => p.role === 'civilian')
    const ucs = state.roundPlayers.filter((p) => p.role === 'undercover')
    expect(civs.length + ucs.length).toBe(5)
    expect(ucs.length).toBeGreaterThanOrEqual(1)
  })

  it('avoids repeated word pairs across rounds', () => {
    let state = startGame()
    // Play again many times — indices should accumulate
    for (let i = 0; i < 10; i++) {
      state = { ...state, phaseState: { phase: 'gameOver', winner: 'civilians', roundScores: {} } }
      state = playAgain(state)
    }
    // All used indices should be unique
    const unique = new Set(state.usedWordIndices)
    expect(unique.size).toBe(state.usedWordIndices.length)
  })

  it('increments round number', () => {
    let state = startGame()
    expect(state.roundNumber).toBe(1)
    state = { ...state, phaseState: { phase: 'gameOver', winner: 'civilians', roundScores: {} } }
    state = playAgain(state)
    expect(state.roundNumber).toBe(2)
  })

  it('initialises scores for all players', () => {
    const state = startGame()
    expect(state.scores).toHaveLength(5)
    for (const s of state.scores) expect(s.total).toBe(0)
  })
})

describe('word reveal flow', () => {
  it('walks through each player', () => {
    let state = startGame()
    expect(state.phaseState.phase).toBe('wordReveal')
    if (state.phaseState.phase !== 'wordReveal') return

    for (let i = 0; i < 5; i++) {
      if (state.phaseState.phase !== 'wordReveal') break
      expect(state.phaseState.currentIndex).toBe(i)
      expect(state.phaseState.revealed).toBe(false)
      state = revealWord(state)
      if (state.phaseState.phase !== 'wordReveal') break
      expect(state.phaseState.revealed).toBe(true)
      state = confirmWordSeen(state)
    }

    expect(state.phaseState.phase).toBe('description')
  })
})

describe('description flow', () => {
  it('walks through alive players then moves to voting', () => {
    let state = startGame()
    state = passWordReveal(state)
    expect(state.phaseState.phase).toBe('description')

    state = passDescriptions(state)
    expect(state.phaseState.phase).toBe('voting')
  })

  it('skipToVoting jumps to voting immediately', () => {
    let state = startGame()
    state = passWordReveal(state)
    state = skipToVoting(state)
    expect(state.phaseState.phase).toBe('voting')
  })
})

describe('anonymous voting', () => {
  it('walks through each voter then eliminates someone', () => {
    let state = startGame(5, DEFAULT_CONFIG, 'anonymous')
    state = passWordReveal(state)
    state = passDescriptions(state)

    expect(state.phaseState.phase).toBe('voting')
    if (state.phaseState.phase !== 'voting') return

    const alive = state.roundPlayers.filter((p) => p.alive)
    const target = alive[0]!.id

    for (let i = 0; i < alive.length; i++) {
      expect(state.phaseState.phase).toBe('voting')
      if (state.phaseState.phase !== 'voting') return
      expect(state.phaseState.awaitingHandoff).toBe(true)
      state = readyToVote(state)
      state = castVote(state, target)
    }

    // Should be in elimination or mrWhiteGuess
    expect(['elimination', 'mrWhiteGuess']).toContain(state.phaseState.phase)
  })
})

describe('open voting', () => {
  it('eliminates the chosen player directly', () => {
    let state = startGame(5, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)
    state = passDescriptions(state)

    const alive = state.roundPlayers.filter((p) => p.alive)
    const target = alive[0]!.id
    state = eliminatePlayer(state, target)

    expect(['elimination', 'mrWhiteGuess']).toContain(state.phaseState.phase)
  })
})

describe('elimination and win conditions', () => {
  it('civilians win when all infiltrators are eliminated', () => {
    let state = startGame(4, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)

    // Find the undercover and eliminate them
    const uc = state.roundPlayers.find((p) => p.role === 'undercover')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, uc.id)

    if (state.phaseState.phase === 'elimination') {
      state = proceedAfterElimination(state)
      expect(state.phaseState.phase).toBe('gameOver')
      if (state.phaseState.phase === 'gameOver') {
        expect(state.phaseState.winner).toBe('civilians')
      }
    }
  })

  it('infiltrators win when only 1 civilian remains', () => {
    let state = startGame(4, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)

    const civs = state.roundPlayers.filter((p) => p.role === 'civilian')
    // Eliminate civilians until only 1 remains
    for (let i = 0; i < civs.length - 1; i++) {
      state = { ...state, phaseState: { phase: 'description', currentIndex: 0 } }
      state = passDescriptions(state)
      state = eliminatePlayer(state, civs[i]!.id)
      if (state.phaseState.phase === 'elimination') {
        state = proceedAfterElimination(state)
      }
    }

    expect(state.phaseState.phase).toBe('gameOver')
    if (state.phaseState.phase === 'gameOver') {
      expect(state.phaseState.winner).toBe('infiltrators')
    }
  })
})

describe('Mr. White guess', () => {
  it('Mr. White wins if they guess the civilian word correctly', () => {
    let state = startGame(4, MR_WHITE_CONFIG, 'open')
    state = passWordReveal(state)

    const mw = state.roundPlayers.find((p) => p.role === 'mrWhite')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, mw.id)

    expect(state.phaseState.phase).toBe('mrWhiteGuess')

    const civilianWord = state.wordPair!.civilian
    state = mrWhiteGuess(state, civilianWord)

    expect(state.phaseState.phase).toBe('gameOver')
    if (state.phaseState.phase === 'gameOver') {
      expect(state.phaseState.winner).toBe('mrWhite')
    }
  })

  it('Mr. White goes to elimination if guess is wrong', () => {
    let state = startGame(4, MR_WHITE_CONFIG, 'open')
    state = passWordReveal(state)

    const mw = state.roundPlayers.find((p) => p.role === 'mrWhite')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, mw.id)

    expect(state.phaseState.phase).toBe('mrWhiteGuess')
    state = mrWhiteGuess(state, 'completely wrong answer')

    expect(state.phaseState.phase).toBe('elimination')
  })

  it('Mr. White can skip the guess', () => {
    let state = startGame(4, MR_WHITE_CONFIG, 'open')
    state = passWordReveal(state)

    const mw = state.roundPlayers.find((p) => p.role === 'mrWhite')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, mw.id)

    state = skipMrWhiteGuess(state)
    expect(state.phaseState.phase).toBe('elimination')
  })
})

describe('scoring', () => {
  it('awards 1 point to each civilian on civilian win', () => {
    let state = startGame(4, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)

    const uc = state.roundPlayers.find((p) => p.role === 'undercover')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, uc.id)
    state = proceedAfterElimination(state)

    expect(state.phaseState.phase).toBe('gameOver')
    if (state.phaseState.phase !== 'gameOver') return

    const civs = state.roundPlayers.filter((p) => p.role === 'civilian')
    for (const c of civs) {
      expect(state.phaseState.roundScores[c.id]).toBe(1)
    }
    expect(state.phaseState.roundScores[uc.id]).toBe(0)
  })

  it('awards 2 points to Mr. White on correct guess', () => {
    let state = startGame(4, MR_WHITE_CONFIG, 'open')
    state = passWordReveal(state)

    const mw = state.roundPlayers.find((p) => p.role === 'mrWhite')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, mw.id)
    state = mrWhiteGuess(state, state.wordPair!.civilian)

    expect(state.phaseState.phase).toBe('gameOver')
    if (state.phaseState.phase !== 'gameOver') return
    expect(state.phaseState.roundScores[mw.id]).toBe(2)
  })

  it('scores accumulate across rounds', () => {
    let state = startGame(4, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)

    const uc = state.roundPlayers.find((p) => p.role === 'undercover')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, uc.id)
    state = proceedAfterElimination(state)

    // Scores after round 1
    const r1Scores = new Map(state.scores.map((s) => [s.id, s.total]))

    // Play again
    state = playAgain(state)
    state = passWordReveal(state)
    const uc2 = state.roundPlayers.find((p) => p.role === 'undercover')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, uc2.id)
    state = proceedAfterElimination(state)

    // Scores should have accumulated
    for (const s of state.scores) {
      expect(s.total).toBeGreaterThanOrEqual(r1Scores.get(s.id) ?? 0)
    }
  })
})

describe('scrapRound', () => {
  it('starts a new round with same players, no points', () => {
    let state = startGame(5, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)
    // Scrap mid-game — should start a fresh round
    state = scrapRound(state)

    expect(state.phaseState.phase).toBe('wordReveal')
    expect(state.roundNumber).toBe(2)
    // All scores still zero — no points were awarded
    for (const s of state.scores) expect(s.total).toBe(0)
    // Everyone alive again
    for (const rp of state.roundPlayers) expect(rp.alive).toBe(true)
  })

  it('keeps scores from completed earlier rounds', () => {
    // Finish round 1 (civilians win)
    let state = startGame(4, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)
    const uc = state.roundPlayers.find((p) => p.role === 'undercover')!
    state = passDescriptions(state)
    state = eliminatePlayer(state, uc.id)
    state = proceedAfterElimination(state)
    expect(state.phaseState.phase).toBe('gameOver')

    // Start round 2
    state = playAgain(state)
    state = passWordReveal(state)

    // Scrap round 2 mid-game
    state = scrapRound(state)
    expect(state.roundNumber).toBe(3)

    // Round 1 scores are still there
    const totalScored = state.scores.reduce((sum, s) => sum + s.total, 0)
    expect(totalScored).toBeGreaterThan(0)
  })
})

describe('scrapRoundToSetup', () => {
  it('goes back to setup, keeps scores and round number', () => {
    let state = startGame(5, DEFAULT_CONFIG, 'open')
    state = passWordReveal(state)
    const roundNum = state.roundNumber
    state = scrapRoundToSetup(state)

    expect(state.phaseState.phase).toBe('setup')
    expect(state.roundNumber).toBe(roundNum)
    expect(state.players).toHaveLength(0) // setup clears players
  })
})

describe('newSession', () => {
  it('resets to initial state', () => {
    const state = newSession()
    expect(state.phaseState.phase).toBe('setup')
    expect(state.players).toHaveLength(0)
    expect(state.roundNumber).toBe(0)
  })
})
