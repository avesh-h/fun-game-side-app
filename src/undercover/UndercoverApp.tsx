import { useCallback, useRef, useState } from 'react'
import { CONTAINER } from '../components/AppShell'
import { useConfirm } from '../ui/ConfirmDialog'
import {
  castVote,
  confirmWordSeen,
  eliminatePlayer,
  endGame,
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
} from './engine/machine'
import type { UcGameState, UcPlayerId } from './engine/types'
import { DescriptionRound } from './screens/DescriptionRound'
import { Elimination } from './screens/Elimination'
import { FinalResults } from './screens/FinalResults'
import { GameOver } from './screens/GameOver'
import { MrWhiteGuess } from './screens/MrWhiteGuess'
import { UcSetup } from './screens/Setup'
import { Voting } from './screens/Voting'
import { WordReveal } from './screens/WordReveal'

interface UndercoverAppProps {
  readonly onBackToMenu: () => void
}

export function UndercoverApp({ onBackToMenu }: UndercoverAppProps) {
  const [state, setState] = useState<UcGameState>(INITIAL_STATE)

  // History stack for undo — every transition pushes the old state.
  // Cleared when a new round starts so undo never crosses round boundaries.
  const historyRef = useRef<UcGameState[]>([])

  const { confirm, dialog } = useConfirm()

  /**
   * Transition with undo support. Pushes the current state onto the
   * history stack before applying the change.
   */
  const transition = useCallback((fn: (prev: UcGameState) => UcGameState) => {
    setState((prev) => {
      try {
        const next = fn(prev)
        historyRef.current = [...historyRef.current, prev]
        return next
      } catch (e) {
        console.error('Undercover transition error:', e)
        return prev
      }
    })
  }, [])

  /**
   * Transition that resets the history — used when starting a new round
   * so undo can never cross the round boundary.
   */
  const transitionFresh = useCallback((fn: (prev: UcGameState) => UcGameState) => {
    setState((prev) => {
      try {
        const next = fn(prev)
        historyRef.current = []
        return next
      } catch (e) {
        console.error('Undercover transition error:', e)
        return prev
      }
    })
  }, [])

  const undo = useCallback(() => {
    const stack = historyRef.current
    if (stack.length === 0) return
    const prev = stack[stack.length - 1]!
    historyRef.current = stack.slice(0, -1)
    setState(prev)
  }, [])

  const canUndo = historyRef.current.length > 0
  const phase = state.phaseState.phase
  const isInRound = phase !== 'setup' && phase !== 'gameOver' && phase !== 'finalResults'

  // -------------------------------------------------------------------------
  // Confirm handlers
  // -------------------------------------------------------------------------

  const handleExit = () => {
    confirm({
      title: 'Leave this round?',
      body: 'The current round will be abandoned. No points will be counted. Scores from previous rounds are kept.',
      confirmLabel: 'Leave',
      tone: 'danger',
      onConfirm: onBackToMenu,
    })
  }

  const handleScrapNewRound = () => {
    confirm({
      title: 'Scrap this round?',
      body: 'No points will be counted. A new round will start with the same players, new words and new roles.',
      confirmLabel: 'Scrap & restart',
      tone: 'danger',
      onConfirm: () => transitionFresh(scrapRound),
    })
  }

  const handleScrapToSetup = () => {
    confirm({
      title: 'Back to setup?',
      body: 'The current round will be scrapped. No points counted. You can change players and settings.',
      confirmLabel: 'Back to setup',
      tone: 'danger',
      onConfirm: () => {
        historyRef.current = []
        setState(scrapRoundToSetup(state))
      },
    })
  }

  return (
    <div className={`${CONTAINER} safe-t safe-b flex min-h-full flex-col`}>
      {/* Floating toolbar — visible during a round */}
      {isInRound && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur">
          <div className="flex items-center gap-2">
            {/* Undo */}
            <button
              type="button"
              disabled={!canUndo}
              onClick={undo}
              title="Undo"
              className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sm text-muted transition-colors enabled:hover:border-accent/40 enabled:active:bg-line disabled:opacity-30"
            >
              ↩
            </button>

            <span className="text-xs text-faint">
              Round {state.roundNumber}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Scrap round — dropdown-like with two options */}
            <button
              type="button"
              onClick={handleScrapNewRound}
              title="Scrap round & restart"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-xs text-muted transition-colors hover:border-warn/40 active:bg-line"
            >
              ↻ Skip round
            </button>

            <button
              type="button"
              onClick={handleScrapToSetup}
              title="Scrap round & change settings"
              className="flex h-9 items-center gap-1.5 rounded-lg border border-line bg-raised px-2.5 text-xs text-muted transition-colors hover:border-warn/40 active:bg-line"
            >
              ⚙ Setup
            </button>

            {/* Exit */}
            <button
              type="button"
              onClick={handleExit}
              title="Leave game"
              className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sm text-muted transition-colors hover:border-bad/40 hover:text-bad active:bg-line"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {phase === 'setup' && (
        <div className="flex flex-1 flex-col gap-4 p-4 lg:px-6 lg:py-8">
          <UcSetup
            onStart={(players, votingMode, roleConfig, scoringConfig) =>
              transitionFresh((s) => startRound(s, players, votingMode, roleConfig, scoringConfig))
            }
            onBack={onBackToMenu}
          />
        </div>
      )}

      {phase === 'wordReveal' && (
        <WordReveal
          state={state}
          onReveal={() => transition(revealWord)}
          onConfirm={() => transition(confirmWordSeen)}
        />
      )}

      {phase === 'description' && (
        <DescriptionRound
          state={state}
          onNext={() => transition(nextDescription)}
          onSkipToVoting={() => transition(skipToVoting)}
        />
      )}

      {phase === 'voting' && (
        <Voting
          state={state}
          onReady={() => transition(readyToVote)}
          onCastVote={(targetId) =>
            transition((s) => castVote(s, targetId as UcPlayerId))
          }
          onEliminate={(targetId) =>
            transition((s) => eliminatePlayer(s, targetId as UcPlayerId))
          }
        />
      )}

      {phase === 'elimination' && (
        <Elimination
          state={state}
          onProceed={() => transition(proceedAfterElimination)}
        />
      )}

      {phase === 'mrWhiteGuess' && (
        <MrWhiteGuess
          state={state}
          onGuess={(guess) => transition((s) => mrWhiteGuess(s, guess))}
          onSkip={() => transition(skipMrWhiteGuess)}
        />
      )}

      {phase === 'gameOver' && (
        <GameOver
          state={state}
          onPlayAgain={() => transitionFresh(playAgain)}
          onEndGame={() => {
            historyRef.current = []
            setState(endGame(state))
          }}
          onNewSession={() => {
            historyRef.current = []
            setState(newSession())
          }}
          onBackToMenu={onBackToMenu}
        />
      )}

      {phase === 'finalResults' && (
        <FinalResults
          state={state}
          onNewSession={() => {
            historyRef.current = []
            setState(newSession())
          }}
          onBackToMenu={onBackToMenu}
        />
      )}

      {dialog}
    </div>
  )
}
