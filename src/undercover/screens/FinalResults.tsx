import { Button } from '../../ui/Button'
import { Panel, PanelTitle } from '../../ui/Panel'
import type { UcGameState } from '../engine/types'

interface FinalResultsProps {
  readonly state: UcGameState
  readonly onNewSession: () => void
  readonly onBackToMenu: () => void
}

/**
 * The final scoreboard — shown when the table decides to end the game.
 *
 * Ranks all players by total score, highlights the winner, and shows
 * how many rounds were played.
 */
export function FinalResults({ state, onNewSession, onBackToMenu }: FinalResultsProps) {
  if (state.phaseState.phase !== 'finalResults') return null

  const sorted = [...state.scores].sort((a, b) => b.total - a.total)
  const topScore = sorted[0]?.total ?? 0
  const winners = sorted.filter((s) => s.total === topScore && topScore > 0)
  const isTie = winners.length > 1

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="text-4xl">🏆</div>
        <p className="text-2xl font-bold">Game Over</p>
        <p className="text-sm text-muted">
          {state.roundNumber} {state.roundNumber === 1 ? 'round' : 'rounds'} played
        </p>
      </div>

      {/* Winner announcement */}
      {topScore > 0 && (
        <Panel className="border-accent/30 bg-accent-soft">
          <div className="text-center">
            {isTie ? (
              <>
                <p className="text-xs uppercase tracking-wider text-faint">It's a tie!</p>
                <p className="mt-1 text-xl font-bold">
                  {winners.map((w) => w.name).join(' & ')}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-wider text-faint">Winner</p>
                <p className="mt-1 text-xl font-bold">{winners[0]?.name}</p>
              </>
            )}
            <p className="mt-1 text-sm text-muted">
              {topScore} {topScore === 1 ? 'point' : 'points'}
            </p>
          </div>
        </Panel>
      )}

      {/* Full leaderboard */}
      <Panel>
        <PanelTitle>Final standings</PanelTitle>
        <div className="flex flex-col gap-1">
          {sorted.map((s, i) => {
            const isWinner = s.total === topScore && topScore > 0
            const rank = i + 1
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null
            return (
              <div
                key={s.id}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm',
                  isWinner ? 'bg-accent-soft' : '',
                ].join(' ')}
              >
                <span className="w-7 shrink-0 text-center">
                  {medal ?? <span className="text-xs text-faint">{rank}</span>}
                </span>
                <span className={`flex-1 ${isWinner ? 'font-bold' : 'font-medium'}`}>
                  {s.name}
                </span>
                <span className={`tnum ${isWinner ? 'font-bold text-accent' : 'font-semibold'}`}>
                  {s.total}
                </span>
              </div>
            )
          })}
        </div>
      </Panel>

      {topScore === 0 && (
        <p className="text-center text-sm text-muted">
          No points were scored. Play a few rounds first!
        </p>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-col gap-2">
        <Button variant="primary" size="lg" fullWidth onClick={onNewSession}>
          New game — fresh start
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onBackToMenu}>
          Back to main menu
        </Button>
      </div>
    </div>
  )
}
