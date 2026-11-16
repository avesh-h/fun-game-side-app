import { useState } from 'react'
import { Button } from '../../ui/Button'
import { TextInput } from '../../ui/TextInput'
import type { UcGameState } from '../engine/types'
import { playerName } from '../engine/types'

interface MrWhiteGuessProps {
  readonly state: UcGameState
  readonly onGuess: (guess: string) => void
  readonly onSkip: () => void
}

export function MrWhiteGuess({ state, onGuess, onSkip }: MrWhiteGuessProps) {
  if (state.phaseState.phase !== 'mrWhiteGuess') return null

  const [guess, setGuess] = useState('')
  const { eliminatedId } = state.phaseState
  const name = playerName(state, eliminatedId)

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 p-4 text-center">
      <div>
        <p className="text-xs uppercase tracking-wider text-faint">Mr. White's last chance</p>
        <p className="mt-2 text-lg font-semibold">{name} was voted out</p>
      </div>

      <div className="w-full max-w-xs rounded-2xl border border-warn/40 bg-warn-soft p-6">
        <p className="text-sm font-medium text-warn">
          Mr. White can guess the civilian word to win!
        </p>
        <p className="mt-2 text-xs text-muted">
          Everyone else — look away from the screen. Only {name} should type.
        </p>

        <div className="mt-4">
          <TextInput
            label="Your guess"
            value={guess}
            onChange={setGuess}
            placeholder="Type the civilian word..."
            autoFocus
          />
        </div>
      </div>

      <div className="flex w-full max-w-xs gap-3">
        <Button variant="ghost" size="md" onClick={onSkip}>
          Skip
        </Button>
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          disabled={guess.trim() === ''}
          onClick={() => onGuess(guess.trim())}
        >
          Guess
        </Button>
      </div>
    </div>
  )
}
