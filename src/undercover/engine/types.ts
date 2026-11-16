/**
 * Undercover — domain model.
 *
 * A social deduction word game. Civilians share one word, Undercovers get a
 * similar-but-different word, and Mr. White gets nothing. Players describe
 * their word out loud, vote to eliminate someone, and repeat until one side
 * wins.
 *
 * The game is a state machine, not event-sourced like poker — there is no
 * money math and no undo requirement, so a simple phase-driven approach is
 * the right fit.
 */

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

/** Stable id for a player across rounds. */
export type UcPlayerId = string & { readonly __ucPlayer: true }

export function ucPlayerId(raw: string): UcPlayerId {
  return raw as UcPlayerId
}

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export type Role = 'civilian' | 'undercover' | 'mrWhite'

export const ROLE_LABELS: Record<Role, string> = {
  civilian: 'Civilian',
  undercover: 'Undercover',
  mrWhite: 'Mr. White',
}

// ---------------------------------------------------------------------------
// Word pairs
// ---------------------------------------------------------------------------

/** A pair of similar-but-different words. Civilians get `civilian`, Undercovers get `undercover`. */
export interface WordPair {
  readonly civilian: string
  readonly undercover: string
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------

export type VotingMode = 'anonymous' | 'open'

export const VOTING_MODE_LABELS: Record<VotingMode, string> = {
  anonymous: 'Anonymous',
  open: 'Open vote',
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export interface UcPlayer {
  readonly id: UcPlayerId
  readonly name: string
}

/** A player within one round of the game. */
export interface RoundPlayer {
  readonly id: UcPlayerId
  readonly role: Role
  /** The word they were shown. Null for Mr. White. */
  readonly word: string | null
  readonly alive: boolean
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface ScoringConfig {
  /** Points each civilian earns when civilians win. */
  readonly civilianWin: number
  /** Points each surviving undercover earns when infiltrators win. */
  readonly undercoverWin: number
  /** Points each surviving Mr. White earns when infiltrators win. */
  readonly mrWhiteWin: number
  /** Points Mr. White earns for guessing the civilian word correctly when voted out. */
  readonly mrWhiteGuess: number
}

export const DEFAULT_SCORING: ScoringConfig = {
  civilianWin: 1,
  undercoverWin: 3,
  mrWhiteWin: 4,
  mrWhiteGuess: 2,
}

export interface PlayerScore {
  readonly id: UcPlayerId
  readonly name: string
  readonly total: number
}

// ---------------------------------------------------------------------------
// Role configuration
// ---------------------------------------------------------------------------

export interface RoleConfig {
  readonly useUndercover: boolean
  readonly useMrWhite: boolean
  /** Number of undercovers. Only meaningful when `useUndercover` is true. */
  readonly undercoverCount: number
  /** Number of Mr. Whites. Only meaningful when `useMrWhite` is true. */
  readonly mrWhiteCount: number
  /** True = app decides counts based on player count. */
  readonly autoDistribute: boolean
}

// ---------------------------------------------------------------------------
// Game phases — a discriminated union
//
// Each phase carries exactly the data that phase needs, and the UI switches
// on `phase` to decide which screen to render.
// ---------------------------------------------------------------------------

export interface SetupPhase {
  readonly phase: 'setup'
}

export interface WordRevealPhase {
  readonly phase: 'wordReveal'
  /** Index of the player currently being shown their word. */
  readonly currentIndex: number
  /** True while the word is visible; false on the "hand to X" screen. */
  readonly revealed: boolean
}

export interface DescriptionPhase {
  readonly phase: 'description'
  /** Index into alive players — whose turn to describe. */
  readonly currentIndex: number
}

export interface VotingPhase {
  readonly phase: 'voting'
  /** Anonymous mode: index of the player currently casting their vote. */
  readonly currentVoterIndex: number
  /** Anonymous mode: accumulated votes (playerId → count). */
  readonly votes: Readonly<Record<string, number>>
  /** Anonymous mode: whether the current voter's screen is the "hand to" prompt. */
  readonly awaitingHandoff: boolean
}

export interface EliminationPhase {
  readonly phase: 'elimination'
  readonly eliminatedId: UcPlayerId
}

export interface MrWhiteGuessPhase {
  readonly phase: 'mrWhiteGuess'
  readonly eliminatedId: UcPlayerId
}

export interface GameOverPhase {
  readonly phase: 'gameOver'
  /** Which side won. */
  readonly winner: 'civilians' | 'infiltrators' | 'mrWhite'
  /** Points earned this round, keyed by player id. */
  readonly roundScores: Readonly<Record<string, number>>
}

export interface FinalResultsPhase {
  readonly phase: 'finalResults'
}

export type GamePhase =
  | SetupPhase
  | WordRevealPhase
  | DescriptionPhase
  | VotingPhase
  | EliminationPhase
  | MrWhiteGuessPhase
  | GameOverPhase
  | FinalResultsPhase

// ---------------------------------------------------------------------------
// The full game state
// ---------------------------------------------------------------------------

export interface UcGameState {
  /** All players in the session, across rounds. */
  readonly players: readonly UcPlayer[]
  readonly votingMode: VotingMode
  readonly roleConfig: RoleConfig
  readonly scoringConfig: ScoringConfig

  /** Current phase + phase-specific data. */
  readonly phaseState: GamePhase

  // -- Round state (populated once a round starts) --------------------------

  /** Players in the current round, with roles and words assigned. */
  readonly roundPlayers: readonly RoundPlayer[]
  /** The word pair for this round. */
  readonly wordPair: WordPair | null
  /** Description turn order for the current round (alive player ids). */
  readonly turnOrder: readonly UcPlayerId[]

  // -- Session scoring ------------------------------------------------------

  readonly scores: readonly PlayerScore[]
  readonly roundNumber: number

  /** Indices of word pairs already used this session, to avoid repeats. */
  readonly usedWordIndices: readonly number[]
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function findRoundPlayer(
  state: UcGameState,
  id: UcPlayerId,
): RoundPlayer | undefined {
  return state.roundPlayers.find((p) => p.id === id)
}

export function alivePlayers(state: UcGameState): readonly RoundPlayer[] {
  return state.roundPlayers.filter((p) => p.alive)
}

export function alivePlayerIds(state: UcGameState): readonly UcPlayerId[] {
  return alivePlayers(state).map((p) => p.id)
}

export function playerName(state: UcGameState, id: UcPlayerId): string {
  return state.players.find((p) => p.id === id)?.name ?? '???'
}
