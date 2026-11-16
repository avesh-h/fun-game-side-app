import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import { Panel, PanelTitle } from '../../ui/Panel'
import type { UcGameState } from '../engine/types'
import { playerName, ROLE_LABELS } from '../engine/types'
import type { BadgeTone } from '../../ui/Badge'

interface GameOverProps {
  readonly state: UcGameState
  readonly onPlayAgain: () => void
  readonly onEndGame: () => void
  readonly onNewSession: () => void
  readonly onBackToMenu: () => void
}

const ROLE_TONES: Record<string, BadgeTone> = {
  civilian: 'good',
  undercover: 'bad',
  mrWhite: 'warn',
}

const WINNER_LABELS: Record<string, string> = {
  civilians: 'Civilians win!',
  infiltrators: 'Infiltrators win!',
  mrWhite: 'Mr. White wins!',
}

const WINNER_DESCRIPTIONS: Record<string, string> = {
  civilians: 'All infiltrators have been found and eliminated.',
  infiltrators: 'The infiltrators survived — too many civilians were eliminated.',
  mrWhite: 'Mr. White correctly guessed the civilian word!',
}

export function GameOver({ state, onPlayAgain, onEndGame, onNewSession, onBackToMenu }: GameOverProps) {
  if (state.phaseState.phase !== 'gameOver') return null

  const { winner, roundScores } = state.phaseState
  const isCivilianWin = winner === 'civilians'

  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      {/* Winner announcement */}
      <div className="flex flex-col items-center gap-3 py-4 text-center">
        <div className={`text-4xl ${isCivilianWin ? '' : ''}`}>
          {winner === 'civilians' ? '🎉' : winner === 'mrWhite' ? '🕵️' : '😈'}
        </div>
        <p className="text-2xl font-bold">{WINNER_LABELS[winner]}</p>
        <p className="text-sm text-muted">{WINNER_DESCRIPTIONS[winner]}</p>
      </div>

      {/* Word reveal */}
      <Panel>
        <PanelTitle>The words</PanelTitle>
        <div className="flex gap-4 text-center">
          <div className="flex-1 rounded-lg bg-raised p-3">
            <p className="text-xs text-faint uppercase">Civilian word</p>
            <p className="mt-1 text-lg font-bold text-accent">{state.wordPair?.civilian}</p>
          </div>
          {state.roundPlayers.some((p) => p.role === 'undercover') && (
            <div className="flex-1 rounded-lg bg-raised p-3">
              <p className="text-xs text-faint uppercase">Undercover word</p>
              <p className="mt-1 text-lg font-bold text-warn">{state.wordPair?.undercover}</p>
            </div>
          )}
        </div>
      </Panel>

      {/* All players revealed */}
      <Panel>
        <PanelTitle>Everyone's role</PanelTitle>
        <div className="flex flex-col gap-2">
          {state.roundPlayers.map((rp) => {
            const tone = ROLE_TONES[rp.role] ?? 'neutral'
            const points = roundScores[rp.id] ?? 0
            return (
              <div
                key={rp.id}
                className={[
                  'flex items-center gap-3 rounded-lg px-3 py-2',
                  rp.alive ? '' : 'opacity-50',
                ].join(' ')}
              >
                <span className="flex-1 text-sm font-medium">
                  {playerName(state, rp.id)}
                  {!rp.alive && <span className="text-faint"> (out)</span>}
                </span>
                <Badge tone={tone}>{ROLE_LABELS[rp.role]}</Badge>
                {points > 0 && (
                  <span className="text-xs font-semibold text-good">+{points}</span>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Scoreboard */}
      <Panel>
        <PanelTitle>Scoreboard — Round {state.roundNumber}</PanelTitle>
        <div className="flex flex-col gap-1">
          {[...state.scores]
            .sort((a, b) => b.total - a.total)
            .map((s, i) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
              >
                <span className="w-5 shrink-0 text-center text-xs text-faint">
                  {i + 1}
                </span>
                <span className="flex-1 font-medium">{s.name}</span>
                <span className="tnum font-semibold">{s.total}</span>
              </div>
            ))}
        </div>
      </Panel>

      {/* Actions */}
      <div className="flex flex-col gap-2 mt-2">
        <Button variant="primary" size="lg" fullWidth onClick={onPlayAgain}>
          Next round — same players
        </Button>
        <Button variant="danger" size="md" fullWidth onClick={onEndGame}>
          End game — final scoreboard
        </Button>
        <Button variant="default" size="sm" fullWidth onClick={onNewSession}>
          New session — new players
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onBackToMenu}>
          Back to main menu
        </Button>
      </div>
    </div>
  )
}
