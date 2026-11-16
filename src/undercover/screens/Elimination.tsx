import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import type { UcGameState } from '../engine/types'
import { playerName, ROLE_LABELS, findRoundPlayer } from '../engine/types'
import type { BadgeTone } from '../../ui/Badge'

interface EliminationProps {
  readonly state: UcGameState
  readonly onProceed: () => void
}

const ROLE_TONES: Record<string, BadgeTone> = {
  civilian: 'good',
  undercover: 'bad',
  mrWhite: 'warn',
}

export function Elimination({ state, onProceed }: EliminationProps) {
  if (state.phaseState.phase !== 'elimination') return null

  const { eliminatedId } = state.phaseState
  const name = playerName(state, eliminatedId)
  const rp = findRoundPlayer(state, eliminatedId)
  if (!rp) return null

  const tone = ROLE_TONES[rp.role] ?? 'neutral'
  const wasCivilian = rp.role === 'civilian'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <p className="text-xs uppercase tracking-wider text-faint">Eliminated</p>

      <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6">
        <p className="text-2xl font-bold">{name}</p>
        <div className="mt-3">
          <Badge tone={tone} className="text-sm">
            {ROLE_LABELS[rp.role]}
          </Badge>
        </div>
        <p className="mt-3 text-sm text-muted">
          {wasCivilian
            ? 'An innocent civilian was eliminated! The infiltrators are closer to winning.'
            : rp.role === 'undercover'
              ? 'An undercover agent has been found!'
              : 'Mr. White has been caught!'}
        </p>
      </div>

      {/* Show remaining players */}
      <div className="w-full max-w-xs">
        <p className="text-xs text-faint mb-2">
          {state.roundPlayers.filter((p) => p.alive).length} players remaining
        </p>
      </div>

      <Button variant="primary" size="lg" onClick={onProceed}>
        Continue
      </Button>
    </div>
  )
}
