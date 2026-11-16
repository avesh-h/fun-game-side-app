import { Button } from '../../ui/Button'
import { Badge } from '../../ui/Badge'
import type { UcGameState } from '../engine/types'

interface WordRevealProps {
  readonly state: UcGameState
  readonly onReveal: () => void
  readonly onConfirm: () => void
}

/**
 * Pass-the-phone word reveal.
 *
 * Two sub-screens alternate:
 *   1. "Hand the phone to Raj" — no word visible
 *   2. Raj's word (or "You are Mr. White") — tap "Got it" to move on
 */
export function WordReveal({ state, onReveal, onConfirm }: WordRevealProps) {
  if (state.phaseState.phase !== 'wordReveal') return null

  const { currentIndex, revealed } = state.phaseState
  const roundPlayer = state.roundPlayers[currentIndex]
  if (!roundPlayer) return null
  const player = state.players.find((p) => p.id === roundPlayer.id)
  if (!player) return null

  const progress = `${currentIndex + 1} of ${state.roundPlayers.length}`

  if (!revealed) {
    // "Hand to" screen — no secrets visible
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
        <p className="text-xs uppercase tracking-wider text-faint">Player {progress}</p>
        <div>
          <p className="text-sm text-muted">Hand the phone to</p>
          <p className="mt-1 text-3xl font-bold">{player.name}</p>
        </div>
        <p className="text-sm text-muted">
          Only {player.name} should see the next screen
        </p>
        <Button variant="primary" size="lg" onClick={onReveal}>
          I am {player.name}
        </Button>
      </div>
    )
  }

  // Word reveal screen
  const isMrWhite = roundPlayer.role === 'mrWhite'

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <p className="text-xs uppercase tracking-wider text-faint">Player {progress}</p>
      <p className="text-lg font-semibold">{player.name}</p>

      <div className="w-full max-w-xs rounded-2xl border border-line bg-surface p-6">
        {isMrWhite ? (
          <>
            <Badge tone="bad" className="mb-3">Mr. White</Badge>
            <p className="text-xl font-bold text-bad">You have no word</p>
            <p className="mt-2 text-sm text-muted">
              Listen to others and bluff your way through.
              If you get voted out, you can try to guess the civilian word to win.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-faint uppercase tracking-wider mb-2">Your word</p>
            <p className="text-3xl font-bold text-accent">{roundPlayer.word}</p>
            <p className="mt-3 text-sm text-muted">
              Remember it. Describe it without giving it away.
            </p>
          </>
        )}
      </div>

      <Button variant="primary" size="lg" onClick={onConfirm}>
        Got it
      </Button>
    </div>
  )
}
