/**
 * The game state machine.
 *
 * Each function takes the current state and returns the next state. No
 * mutation, no side effects, no React. The UI calls these and re-renders.
 *
 * Phase transitions:
 *   setup → wordReveal → description → voting → elimination
 *                                                   ↓
 *                                        (mr white?) → mrWhiteGuess
 *                                                   ↓
 *                                        win? → gameOver → (play again → setup)
 *                                        no?  → back to description
 */

import { assignRoles, autoDistribute, buildTurnOrder, manualDistribute, validateDistribution } from './roles'
import type {
  PlayerScore,
  RoleConfig,
  ScoringConfig,
  UcGameState,
  UcPlayer,
  UcPlayerId,
  VotingMode,
} from './types'
import { DEFAULT_SCORING } from './types'
import { alivePlayers, alivePlayerIds, findRoundPlayer } from './types'
import { pickWordPair } from './words'

// ---------------------------------------------------------------------------
// Initial state
// ---------------------------------------------------------------------------

export const INITIAL_STATE: UcGameState = {
  players: [],
  votingMode: 'anonymous',
  roleConfig: {
    useUndercover: true,
    useMrWhite: false,
    undercoverCount: 1,
    mrWhiteCount: 1,
    autoDistribute: true,
  },
  scoringConfig: DEFAULT_SCORING,
  phaseState: { phase: 'setup' },
  roundPlayers: [],
  wordPair: null,
  turnOrder: [],
  scores: [],
  roundNumber: 0,
  usedWordIndices: [],
}

// ---------------------------------------------------------------------------
// Setup → Start round
// ---------------------------------------------------------------------------

export function startRound(
  state: UcGameState,
  players: readonly UcPlayer[],
  votingMode: VotingMode,
  roleConfig: RoleConfig,
  scoringConfig: ScoringConfig = DEFAULT_SCORING,
): UcGameState {
  const playerCount = players.length

  // Determine role counts
  const counts = roleConfig.autoDistribute
    ? autoDistribute(playerCount, roleConfig.useUndercover, roleConfig.useMrWhite)
    : manualDistribute(playerCount, roleConfig)

  const error = validateDistribution(playerCount, counts)
  if (error) throw new Error(error)

  // Pick a word pair
  const { pair, index } = pickWordPair(state.usedWordIndices)

  // Assign roles
  const roundPlayers = assignRoles(players, counts, pair.civilian, pair.undercover)
  const turnOrder = buildTurnOrder(roundPlayers)

  // Initialise or carry forward scores
  const existingScoreMap = new Map(state.scores.map((s) => [s.id, s]))
  const scores: PlayerScore[] = players.map((p) => {
    const existing = existingScoreMap.get(p.id)
    return existing ?? { id: p.id, name: p.name, total: 0 }
  })

  return {
    players,
    votingMode,
    roleConfig,
    scoringConfig,
    phaseState: { phase: 'wordReveal', currentIndex: 0, revealed: false },
    roundPlayers,
    wordPair: pair,
    turnOrder,
    scores,
    roundNumber: state.roundNumber + 1,
    usedWordIndices: [...state.usedWordIndices, index],
  }
}

// ---------------------------------------------------------------------------
// Word reveal — pass the phone
// ---------------------------------------------------------------------------

/** Player taps to see their word. */
export function revealWord(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'wordReveal') throw new Error('Not in word reveal phase')
  return {
    ...state,
    phaseState: { ...state.phaseState, revealed: true },
  }
}

/** Player taps "Got it" — move to next player or start descriptions. */
export function confirmWordSeen(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'wordReveal') throw new Error('Not in word reveal phase')

  const nextIndex = state.phaseState.currentIndex + 1
  if (nextIndex < state.roundPlayers.length) {
    return {
      ...state,
      phaseState: { phase: 'wordReveal', currentIndex: nextIndex, revealed: false },
    }
  }

  // Everyone has seen their word — move to description phase
  return {
    ...state,
    phaseState: { phase: 'description', currentIndex: 0 },
  }
}

// ---------------------------------------------------------------------------
// Description — turn tracker
// ---------------------------------------------------------------------------

/** Advance to the next descriptor, or move to voting when all have spoken. */
export function nextDescription(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'description') throw new Error('Not in description phase')

  const alive = alivePlayerIds(state)
  const nextIndex = state.phaseState.currentIndex + 1

  if (nextIndex < alive.length) {
    return {
      ...state,
      phaseState: { phase: 'description', currentIndex: nextIndex },
    }
  }

  // Everyone has described — move to voting
  return moveToVoting(state)
}

/** Skip straight to voting (e.g. if the table decides to stop describing). */
export function skipToVoting(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'description') throw new Error('Not in description phase')
  return moveToVoting(state)
}

function moveToVoting(state: UcGameState): UcGameState {
  if (state.votingMode === 'anonymous') {
    return {
      ...state,
      phaseState: {
        phase: 'voting',
        currentVoterIndex: 0,
        votes: {},
        awaitingHandoff: true,
      },
    }
  }
  // Open voting — go straight to voting with empty tallies
  return {
    ...state,
    phaseState: {
      phase: 'voting',
      currentVoterIndex: 0,
      votes: {},
      awaitingHandoff: false,
    },
  }
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

/** Anonymous mode: the voter is ready to cast (dismiss the "hand to" screen). */
export function readyToVote(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'voting') throw new Error('Not in voting phase')
  return {
    ...state,
    phaseState: { ...state.phaseState, awaitingHandoff: false },
  }
}

/** Anonymous mode: a player casts their vote. */
export function castVote(state: UcGameState, targetId: UcPlayerId): UcGameState {
  if (state.phaseState.phase !== 'voting') throw new Error('Not in voting phase')

  const votes = { ...state.phaseState.votes }
  votes[targetId] = (votes[targetId] ?? 0) + 1

  const alive = alivePlayers(state)
  const nextVoterIndex = state.phaseState.currentVoterIndex + 1

  if (nextVoterIndex < alive.length) {
    return {
      ...state,
      phaseState: {
        phase: 'voting',
        currentVoterIndex: nextVoterIndex,
        votes,
        awaitingHandoff: true,
      },
    }
  }

  // Everyone has voted — find the most voted player
  return resolveVotes(state, votes)
}

/** Open mode: the table taps to eliminate someone directly. */
export function eliminatePlayer(state: UcGameState, targetId: UcPlayerId): UcGameState {
  if (state.phaseState.phase !== 'voting') throw new Error('Not in voting phase')

  const target = findRoundPlayer(state, targetId)
  if (!target || !target.alive) throw new Error('That player is not alive')

  return moveToElimination(state, targetId)
}

function resolveVotes(
  state: UcGameState,
  votes: Readonly<Record<string, number>>,
): UcGameState {
  const alive = alivePlayers(state)

  // Find the player(s) with the most votes
  let maxVotes = 0
  for (const p of alive) {
    const count = votes[p.id] ?? 0
    if (count > maxVotes) maxVotes = count
  }

  const topVoted = alive.filter((p) => (votes[p.id] ?? 0) === maxVotes)

  // Tie: pick randomly among the tied players
  const eliminated = topVoted.length === 1
    ? topVoted[0]!
    : topVoted[Math.floor(Math.random() * topVoted.length)]!

  return moveToElimination(state, eliminated.id)
}

function moveToElimination(state: UcGameState, eliminatedId: UcPlayerId): UcGameState {
  // Mark the player as not alive
  const roundPlayers = state.roundPlayers.map((p) =>
    p.id === eliminatedId ? { ...p, alive: false } : p,
  )

  const eliminated = state.roundPlayers.find((p) => p.id === eliminatedId)!

  // Check if Mr. White was eliminated — they get to guess
  if (eliminated.role === 'mrWhite') {
    return {
      ...state,
      roundPlayers,
      phaseState: { phase: 'mrWhiteGuess', eliminatedId },
    }
  }

  return {
    ...state,
    roundPlayers,
    phaseState: { phase: 'elimination', eliminatedId },
  }
}

// ---------------------------------------------------------------------------
// Mr. White guess
// ---------------------------------------------------------------------------

/** Mr. White guesses the civilian word. */
export function mrWhiteGuess(state: UcGameState, guess: string): UcGameState {
  if (state.phaseState.phase !== 'mrWhiteGuess') throw new Error('Not in Mr. White guess phase')

  const civilianWord = state.wordPair?.civilian ?? ''
  const correct = guess.trim().toLowerCase() === civilianWord.trim().toLowerCase()

  if (correct) {
    // Mr. White wins!
    return applyGameOver(state, 'mrWhite')
  }

  // Wrong guess — continue to elimination reveal, then check win conditions
  return {
    ...state,
    phaseState: { phase: 'elimination', eliminatedId: state.phaseState.eliminatedId },
  }
}

/** Mr. White skips the guess (doesn't want to try). */
export function skipMrWhiteGuess(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'mrWhiteGuess') throw new Error('Not in Mr. White guess phase')
  return {
    ...state,
    phaseState: { phase: 'elimination', eliminatedId: state.phaseState.eliminatedId },
  }
}

// ---------------------------------------------------------------------------
// Elimination → check win → next round or game over
// ---------------------------------------------------------------------------

/** After seeing the elimination, proceed to the next phase. */
export function proceedAfterElimination(state: UcGameState): UcGameState {
  if (state.phaseState.phase !== 'elimination') throw new Error('Not in elimination phase')

  const winner = checkWinCondition(state)
  if (winner) {
    return applyGameOver(state, winner)
  }

  // No winner yet — next round of descriptions
  const alive = alivePlayerIds(state)
  return {
    ...state,
    turnOrder: alive,
    phaseState: { phase: 'description', currentIndex: 0 },
  }
}

// ---------------------------------------------------------------------------
// Win conditions
// ---------------------------------------------------------------------------

type Winner = 'civilians' | 'infiltrators' | 'mrWhite'

function checkWinCondition(state: UcGameState): Winner | null {
  const alive = alivePlayers(state)
  const aliveCivilians = alive.filter((p) => p.role === 'civilian')
  const aliveInfiltrators = alive.filter((p) => p.role !== 'civilian')

  // All infiltrators eliminated → civilians win
  if (aliveInfiltrators.length === 0) return 'civilians'

  // Only 1 civilian left → infiltrators win
  if (aliveCivilians.length <= 1) return 'infiltrators'

  return null
}

// ---------------------------------------------------------------------------
// Game over + scoring
// ---------------------------------------------------------------------------

function applyGameOver(state: UcGameState, winner: Winner): UcGameState {
  const roundScores: Record<string, number> = {}
  const sc = state.scoringConfig

  for (const rp of state.roundPlayers) {
    let points = 0

    if (winner === 'civilians' && rp.role === 'civilian') {
      points = sc.civilianWin
    } else if (winner === 'infiltrators' && rp.role === 'undercover' && rp.alive) {
      points = sc.undercoverWin
    } else if (winner === 'infiltrators' && rp.role === 'mrWhite' && rp.alive) {
      points = sc.mrWhiteWin
    } else if (winner === 'mrWhite' && rp.role === 'mrWhite') {
      points = sc.mrWhiteGuess
    }

    roundScores[rp.id] = points
  }

  const scores = state.scores.map((s) => ({
    ...s,
    total: s.total + (roundScores[s.id] ?? 0),
  }))

  return {
    ...state,
    scores,
    phaseState: { phase: 'gameOver', winner, roundScores },
  }
}

// ---------------------------------------------------------------------------
// Play again (new round, same players) or new session
// ---------------------------------------------------------------------------

/** Start a new round with the same players and settings. */
export function playAgain(state: UcGameState): UcGameState {
  return startRound(state, state.players, state.votingMode, state.roleConfig, state.scoringConfig)
}

/**
 * Scrap the current round — no points for anyone — and start fresh.
 * Scores from previous rounds are kept. A new word pair and role shuffle.
 */
export function scrapRound(state: UcGameState): UcGameState {
  return startRound(state, state.players, state.votingMode, state.roleConfig, state.scoringConfig)
}

/**
 * Scrap the current round and go back to the setup screen.
 * Scores from previous rounds are kept.
 */
export function scrapRoundToSetup(state: UcGameState): UcGameState {
  return {
    ...INITIAL_STATE,
    scores: state.scores,
    roundNumber: state.roundNumber,
    usedWordIndices: state.usedWordIndices,
  }
}

/**
 * End the game session and show the final scoreboard.
 * Called from the game-over screen when the table is done playing.
 */
export function endGame(state: UcGameState): UcGameState {
  return {
    ...state,
    phaseState: { phase: 'finalResults' },
  }
}

/** Back to the main menu — fresh state. */
export function newSession(): UcGameState {
  return INITIAL_STATE
}
