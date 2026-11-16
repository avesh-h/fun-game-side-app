import { Button } from '../../ui/Button'
import type { UcGameState } from '../engine/types'
import { playerName } from '../engine/types'

interface VotingProps {
  readonly state: UcGameState
  readonly onReady: () => void
  readonly onCastVote: (targetId: string) => void
  readonly onEliminate: (targetId: string) => void
}

/**
 * Two voting modes:
 *
 * Anonymous: pass-the-phone, each player taps secretly, results revealed at end.
 * Open: discuss out loud, then one person taps to eliminate.
 */
export function Voting({ state, onReady, onCastVote, onEliminate }: VotingProps) {
  if (state.phaseState.phase !== 'voting') return null

  const alive = state.roundPlayers.filter((p) => p.alive)

  // Anonymous mode
  if (state.votingMode === 'anonymous') {
    const { currentVoterIndex, awaitingHandoff } = state.phaseState
    const currentVoter = alive[currentVoterIndex]
    if (!currentVoter) return null

    // "Hand to" prompt
    if (awaitingHandoff) {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
          <p className="text-xs uppercase tracking-wider text-faint">
            Anonymous vote — {currentVoterIndex + 1} of {alive.length}
          </p>
          <div>
            <p className="text-sm text-muted">Hand the phone to</p>
            <p className="mt-1 text-3xl font-bold">
              {playerName(state, currentVoter.id)}
            </p>
          </div>
          <p className="text-sm text-muted">
            Only they should see who they vote for
          </p>
          <Button variant="primary" size="lg" onClick={onReady}>
            I am {playerName(state, currentVoter.id)}
          </Button>
        </div>
      )
    }

    // Vote screen: tap a name
    return (
      <div className="flex flex-1 flex-col gap-4 p-4">
        <div className="text-center">
          <p className="text-xs uppercase tracking-wider text-faint">
            Vote — {currentVoterIndex + 1} of {alive.length}
          </p>
          <p className="mt-1 text-lg font-semibold">
            {playerName(state, currentVoter.id)}, who do you suspect?
          </p>
          <p className="text-sm text-muted">Tap a name to vote</p>
        </div>

        <div className="flex flex-col gap-2">
          {alive.map((p) => {
            if (p.id === currentVoter.id) return null // Can't vote for yourself
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onCastVote(p.id)}
                className="flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface px-4 text-base font-medium transition-colors hover:border-accent/40 hover:bg-raised active:bg-raised"
              >
                {playerName(state, p.id)}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // Open mode: tap to eliminate
  return (
    <div className="flex flex-1 flex-col gap-4 p-4">
      <div className="text-center">
        <p className="text-xs uppercase tracking-wider text-faint">Open vote</p>
        <p className="mt-1 text-lg font-semibold">Who is getting eliminated?</p>
        <p className="text-sm text-muted">Discuss and decide, then tap a name</p>
      </div>

      <div className="flex flex-col gap-2">
        {alive.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onEliminate(p.id)}
            className="flex min-h-14 items-center justify-center rounded-xl border border-line bg-surface px-4 text-base font-medium transition-colors hover:border-bad/40 hover:bg-raised active:bg-raised"
          >
            {playerName(state, p.id)}
          </button>
        ))}
      </div>
    </div>
  )
}
