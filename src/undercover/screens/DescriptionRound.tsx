import { Button } from '../../ui/Button'
import { Panel } from '../../ui/Panel'
import type { UcGameState } from '../engine/types'
import { playerName } from '../engine/types'

interface DescriptionRoundProps {
  readonly state: UcGameState
  readonly onNext: () => void
  readonly onSkipToVoting: () => void
}

/**
 * Turn tracker for the description phase.
 *
 * The actual describing happens out loud — the app just shows whose turn it
 * is and lets the operator advance.
 */
export function DescriptionRound({ state, onNext, onSkipToVoting }: DescriptionRoundProps) {
  if (state.phaseState.phase !== 'description') return null

  const alive = state.roundPlayers.filter((p) => p.alive)
  const { currentIndex } = state.phaseState
  const currentPlayer = alive[currentIndex]
  const isLast = currentIndex === alive.length - 1

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-faint">
          Round {state.roundNumber} — Describe your word
        </p>
        <p className="mt-1 text-sm text-muted">
          {currentIndex + 1} of {alive.length} players
        </p>
      </div>

      {/* Current speaker */}
      {currentPlayer && (
        <div className="flex flex-col items-center gap-2 py-6">
          <p className="text-sm text-muted">It's</p>
          <p className="text-3xl font-bold">
            {playerName(state, currentPlayer.id)}'s
          </p>
          <p className="text-sm text-muted">turn to describe</p>
        </div>
      )}

      {/* Player list */}
      <Panel>
        <div className="flex flex-col gap-1">
          {alive.map((p, i) => {
            const isCurrent = i === currentIndex
            const isDone = i < currentIndex
            return (
              <div
                key={p.id}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
                  isCurrent ? 'border border-accent/40 bg-accent-soft font-semibold' : '',
                  isDone ? 'text-faint' : '',
                ].join(' ')}
              >
                <span className="w-5 shrink-0 text-center text-xs text-faint">
                  {isDone ? '✓' : i + 1}
                </span>
                <span>{playerName(state, p.id)}</span>
                {isCurrent && (
                  <span className="ml-auto text-xs text-accent">speaking</span>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      <div className="mt-auto flex gap-3">
        <Button variant="ghost" size="md" onClick={onSkipToVoting}>
          Skip to vote
        </Button>
        <Button variant="primary" size="lg" className="flex-1" onClick={onNext}>
          {isLast ? 'Start voting' : 'Next player'}
        </Button>
      </div>
    </div>
  )
}
