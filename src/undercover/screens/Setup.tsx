import { useState } from 'react'
import { Button } from '../../ui/Button'
import { NumberInput } from '../../ui/NumberInput'
import { Panel, PanelTitle } from '../../ui/Panel'
import { TextInput } from '../../ui/TextInput'
import { minimumPlayers } from '../engine/roles'
import type { RoleConfig, ScoringConfig, UcPlayer, VotingMode } from '../engine/types'
import { DEFAULT_SCORING, ucPlayerId } from '../engine/types'
import { makeId } from '../../state/ids'

interface SetupProps {
  readonly onStart: (
    players: readonly UcPlayer[],
    votingMode: VotingMode,
    roleConfig: RoleConfig,
    scoringConfig: ScoringConfig,
  ) => void
  readonly onBack: () => void
}

export function UcSetup({ onStart, onBack }: SetupProps) {
  const [names, setNames] = useState<string[]>(['', '', ''])
  const [votingMode, setVotingMode] = useState<VotingMode>('anonymous')
  const [useUndercover, setUseUndercover] = useState(true)
  const [useMrWhite, setUseMrWhite] = useState(false)
  const [autoDistribute, setAutoDistribute] = useState(true)
  const [ucCount, setUcCount] = useState('1')
  const [mwCount, setMwCount] = useState('1')
  const [useDefaultScoring, setUseDefaultScoring] = useState(true)
  const [sCivilianWin, setSCivilianWin] = useState(String(DEFAULT_SCORING.civilianWin))
  const [sUndercoverWin, setSUndercoverWin] = useState(String(DEFAULT_SCORING.undercoverWin))
  const [sMrWhiteWin, setSMrWhiteWin] = useState(String(DEFAULT_SCORING.mrWhiteWin))
  const [sMrWhiteGuess, setSMrWhiteGuess] = useState(String(DEFAULT_SCORING.mrWhiteGuess))
  const [error, setError] = useState<string | null>(null)
  const [attempted, setAttempted] = useState(false)

  const addPlayer = () => setNames((prev) => [...prev, ''])
  const removePlayer = (index: number) => {
    if (names.length <= 3) return
    setNames((prev) => prev.filter((_, i) => i !== index))
  }
  const updateName = (index: number, value: string) => {
    setNames((prev) => prev.map((n, i) => (i === index ? value : n)))
  }

  const roleConfig: RoleConfig = {
    useUndercover,
    useMrWhite,
    undercoverCount: parseInt(ucCount) || 1,
    mrWhiteCount: parseInt(mwCount) || 1,
    autoDistribute,
  }

  const minPlayers = minimumPlayers(roleConfig)
  const filledNames = names.filter((n) => n.trim() !== '')
  const uniqueNames = new Set(filledNames.map((n) => n.trim().toLowerCase()))

  const validate = (): string | null => {
    if (!useUndercover && !useMrWhite) return 'Enable at least one infiltrator role'
    if (filledNames.length < minPlayers) return `Need at least ${minPlayers} players`
    if (uniqueNames.size < filledNames.length) return 'Player names must be unique'
    if (!autoDistribute) {
      const uc = useUndercover ? (parseInt(ucCount) || 0) : 0
      const mw = useMrWhite ? (parseInt(mwCount) || 0) : 0
      const civs = filledNames.length - uc - mw
      if (civs < 1) return 'Not enough civilians'
      if (uc + mw < 1) return 'Need at least one infiltrator'
      if (civs <= uc + mw) return 'Civilians must outnumber infiltrators'
    }
    return null
  }

  const handleStart = () => {
    setAttempted(true)
    const err = validate()
    if (err) {
      setError(err)
      return
    }

    const players: UcPlayer[] = filledNames.map((name) => ({
      id: ucPlayerId(makeId()),
      name: name.trim(),
    }))

    const scoringConfig: ScoringConfig = useDefaultScoring
      ? DEFAULT_SCORING
      : {
          civilianWin: parseInt(sCivilianWin) || 0,
          undercoverWin: parseInt(sUndercoverWin) || 0,
          mrWhiteWin: parseInt(sMrWhiteWin) || 0,
          mrWhiteGuess: parseInt(sMrWhiteGuess) || 0,
        }

    onStart(players, votingMode, roleConfig, scoringConfig)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sm text-muted active:bg-line"
        >
          ←
        </button>
        <div>
          <h2 className="text-lg font-semibold">Undercover</h2>
          <p className="text-xs text-muted">Set up a new round</p>
        </div>
      </div>

      {/* Players */}
      <Panel>
        <PanelTitle>Players</PanelTitle>
        <div className="flex flex-col gap-2">
          {names.map((name, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-center text-xs text-faint">{i + 1}</span>
              <TextInput
                label={`Player ${i + 1}`}
                labelHidden
                value={name}
                onChange={(v) => updateName(i, v)}
                placeholder={`Player ${i + 1}`}
                invalid={attempted && name.trim() === '' && i < minPlayers}
              />
              {names.length > 3 && (
                <button
                  type="button"
                  onClick={() => removePlayer(i)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg text-sm text-faint hover:text-bad active:bg-raised"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        {names.length < 20 && (
          <Button variant="ghost" size="sm" fullWidth className="mt-2" onClick={addPlayer}>
            + Add player
          </Button>
        )}
      </Panel>

      {/* Roles */}
      <Panel>
        <PanelTitle>Roles</PanelTitle>
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useUndercover}
              onChange={(e) => setUseUndercover(e.target.checked)}
              className="size-5 rounded accent-accent"
            />
            <div>
              <span className="text-sm font-medium">Undercover</span>
              <p className="text-xs text-muted">Gets a similar but different word</p>
            </div>
          </label>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={useMrWhite}
              onChange={(e) => setUseMrWhite(e.target.checked)}
              className="size-5 rounded accent-accent"
            />
            <div>
              <span className="text-sm font-medium">Mr. White</span>
              <p className="text-xs text-muted">Gets no word — must bluff from descriptions</p>
            </div>
          </label>

          {(!useUndercover && !useMrWhite) && (
            <p className="text-xs text-bad">Enable at least one infiltrator role</p>
          )}
        </div>

        <div className="mt-4 border-t border-line-soft pt-3">
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={autoDistribute}
              onChange={(e) => setAutoDistribute(e.target.checked)}
              className="size-5 rounded accent-accent"
            />
            <div>
              <span className="text-sm font-medium">Auto role counts</span>
              <p className="text-xs text-muted">App picks how many of each role</p>
            </div>
          </label>

          {!autoDistribute && (
            <div className="mt-3 flex gap-3">
              {useUndercover && (
                <NumberInput
                  label="Undercovers"
                  value={ucCount}
                  onChange={setUcCount}
                  placeholder="1"
                />
              )}
              {useMrWhite && (
                <NumberInput
                  label="Mr. Whites"
                  value={mwCount}
                  onChange={setMwCount}
                  placeholder="1"
                />
              )}
            </div>
          )}
        </div>
      </Panel>

      {/* Voting mode */}
      <Panel>
        <PanelTitle>Voting</PanelTitle>
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-accent/50 has-[:checked]:bg-accent-soft">
            <input
              type="radio"
              name="votingMode"
              checked={votingMode === 'anonymous'}
              onChange={() => setVotingMode('anonymous')}
              className="accent-accent"
            />
            <div>
              <span className="text-sm font-medium">Anonymous</span>
              <p className="text-xs text-muted">Pass the phone — each player votes secretly</p>
            </div>
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-line p-3 has-[:checked]:border-accent/50 has-[:checked]:bg-accent-soft">
            <input
              type="radio"
              name="votingMode"
              checked={votingMode === 'open'}
              onChange={() => setVotingMode('open')}
              className="accent-accent"
            />
            <div>
              <span className="text-sm font-medium">Open vote</span>
              <p className="text-xs text-muted">Discuss out loud, then tap to eliminate</p>
            </div>
          </label>
        </div>
      </Panel>

      {/* Scoring */}
      <Panel>
        <PanelTitle>Points</PanelTitle>

        {/* Info: default points */}
        <div className="mb-3 rounded-lg bg-raised p-3">
          <p className="text-xs font-medium text-muted mb-2">How points work</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <span className="text-faint">Civilian win</span>
            <span className="text-ink font-medium">{useDefaultScoring ? DEFAULT_SCORING.civilianWin : (parseInt(sCivilianWin) || 0)} pt each</span>
            <span className="text-faint">Undercover survives</span>
            <span className="text-ink font-medium">{useDefaultScoring ? DEFAULT_SCORING.undercoverWin : (parseInt(sUndercoverWin) || 0)} pts</span>
            <span className="text-faint">Mr. White survives</span>
            <span className="text-ink font-medium">{useDefaultScoring ? DEFAULT_SCORING.mrWhiteWin : (parseInt(sMrWhiteWin) || 0)} pts</span>
            <span className="text-faint">Mr. White guesses word</span>
            <span className="text-ink font-medium">{useDefaultScoring ? DEFAULT_SCORING.mrWhiteGuess : (parseInt(sMrWhiteGuess) || 0)} pts</span>
          </div>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            checked={useDefaultScoring}
            onChange={(e) => setUseDefaultScoring(e.target.checked)}
            className="size-5 rounded accent-accent"
          />
          <div>
            <span className="text-sm font-medium">Use default points</span>
            <p className="text-xs text-muted">Uncheck to set your own</p>
          </div>
        </label>

        {!useDefaultScoring && (
          <div className="mt-3 grid grid-cols-2 gap-3">
            <NumberInput
              label="Civilian win"
              value={sCivilianWin}
              onChange={setSCivilianWin}
              placeholder="1"
              hint="per civilian"
            />
            <NumberInput
              label="Undercover win"
              value={sUndercoverWin}
              onChange={setSUndercoverWin}
              placeholder="3"
              hint="per survivor"
            />
            <NumberInput
              label="Mr. White win"
              value={sMrWhiteWin}
              onChange={setSMrWhiteWin}
              placeholder="4"
              hint="survives to end"
            />
            <NumberInput
              label="Mr. White guess"
              value={sMrWhiteGuess}
              onChange={setSMrWhiteGuess}
              placeholder="2"
              hint="guesses word"
            />
          </div>
        )}
      </Panel>

      {attempted && error && (
        <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
          {error}
        </p>
      )}

      <Button variant="primary" size="lg" fullWidth onClick={handleStart}>
        Start round
      </Button>
    </div>
  )
}
