import { useMemo, useState } from 'react'
import { ev } from '../engine/events'
import { formatMoney } from '../engine/money'
import { makeId } from '../state/ids'
import { useStore } from '../state/StoreProvider'
import { Button } from '../ui/Button'
import { NumberInput } from '../ui/NumberInput'
import { Panel, PanelTitle } from '../ui/Panel'
import { TextInput } from '../ui/TextInput'
import { blankPlayer, defaultDraft, validateSetup, type SetupDraft } from './setupModel'

const MAX_PLAYERS = 10

export function Setup() {
  const { dispatch } = useStore()

  const [draft, setDraft] = useState<SetupDraft>(() =>
    defaultDraft([makeId(), makeId(), makeId()]),
  )
  // The minimum bet follows the boot until somebody deliberately changes it,
  // which is what almost everyone wants and nobody wants to have to think about.
  const [minBetPinned, setMinBetPinned] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const check = useMemo(() => validateSetup(draft), [draft])
  const errors = showErrors ? check.errors : { byPlayer: {} }

  const patch = (next: Partial<SetupDraft>) => setDraft((d) => ({ ...d, ...next }))

  const setBoot = (boot: string) =>
    patch(minBetPinned ? { boot } : { boot, minBet: boot })

  const setPlayer = (key: string, next: Partial<{ name: string; buyIn: string }>) =>
    patch({
      players: draft.players.map((p) => (p.key === key ? { ...p, ...next } : p)),
    })

  const addPlayer = () =>
    patch({ players: [...draft.players, blankPlayer(makeId(), draft.defaultBuyIn)] })

  const removePlayer = (key: string) =>
    patch({ players: draft.players.filter((p) => p.key !== key) })

  const start = () => {
    if (!check.ready) {
      setShowErrors(true)
      return
    }
    dispatch(ev.gameCreated(check.ready.config, check.ready.players))
  }

  return (
    // Money settings and the player list are independent, so on a wider screen
    // they sit side by side instead of making you scroll past one to reach the
    // other.
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-2 lg:items-start lg:gap-4">
      <Panel>
        <PanelTitle>The money</PanelTitle>
        <div className="flex flex-col gap-3">
          <NumberInput
            label="Bank"
            value={draft.bank}
            onChange={(bank) => patch({ bank })}
            error={errors.bank}
            hint="The pool everyone borrows from. The only place money comes from."
          />
          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Boot"
              value={draft.boot}
              onChange={setBoot}
              error={errors.boot}
              hint="Paid by everyone, every hand"
            />
            <NumberInput
              label="Minimum bet"
              value={draft.minBet}
              onChange={(minBet) => {
                setMinBetPinned(true)
                patch({ minBet })
              }}
              error={errors.minBet}
              hint={minBetPinned ? 'Set by hand' : 'Following the boot'}
            />
          </div>
          <NumberInput
            label="Table charge"
            value={draft.rake}
            onChange={(rake) => patch({ rake })}
            error={errors.rake}
            hint="Extra per player each hand that goes back to the bank instead of the pot. Sometimes called a rake. Leave at 0 for none."
          />
          <NumberInput
            label="Default buy-in"
            value={draft.defaultBuyIn}
            onChange={(defaultBuyIn) => patch({ defaultBuyIn })}
            error={errors.defaultBuyIn}
            hint="Suggested amount when someone re-buys later"
          />
        </div>
      </Panel>

      <Panel>
        <PanelTitle>Players</PanelTitle>

        <div className="flex flex-col gap-3">
          {draft.players.map((player, index) => {
            const rowError = errors.byPlayer[player.key]
            return (
              <div key={player.key} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="tnum w-3 shrink-0 text-xs text-faint">{index + 1}</span>

                  <TextInput
                    label={`Player ${index + 1} name`}
                    labelHidden
                    placeholder="Name"
                    value={player.name}
                    invalid={Boolean(rowError)}
                    onChange={(name) => setPlayer(player.key, { name })}
                  />

                  <div className="w-28 shrink-0">
                    <NumberInput
                      label={`Player ${index + 1} starting money`}
                      labelHidden
                      placeholder="Chips"
                      value={player.buyIn}
                      invalid={Boolean(rowError)}
                      onChange={(buyIn) => setPlayer(player.key, { buyIn })}
                    />
                  </div>

                  <button
                    type="button"
                    aria-label={`Remove player ${index + 1}`}
                    disabled={draft.players.length <= 2}
                    onClick={() => removePlayer(player.key)}
                    className="flex size-9 shrink-0 items-center justify-center rounded-lg text-faint active:bg-raised disabled:opacity-25"
                  >
                    ✕
                  </button>
                </div>

                {rowError && <p className="pl-5 text-xs text-bad">{rowError}</p>}
              </div>
            )
          })}
        </div>

        {errors.players && <p className="mt-2 text-xs text-bad">{errors.players}</p>}

        <Button
          className="mt-3"
          fullWidth
          disabled={draft.players.length >= MAX_PLAYERS}
          onClick={addPlayer}
        >
          {draft.players.length >= MAX_PLAYERS ? 'Ten players is the limit' : '+ Add player'}
        </Button>
      </Panel>

      <Panel className="lg:col-span-2">
        <dl className="tnum grid grid-cols-2 gap-y-1.5 text-sm lg:grid-cols-6">
          <dt className="text-faint">Players</dt>
          <dd className="text-right">{draft.players.length}</dd>
          <dt className="text-faint">Costs each, per hand</dt>
          <dd className="text-right">{formatMoney(check.entryCost)}</dd>
          <dt className="text-faint">On the table</dt>
          <dd className="text-right">{formatMoney(check.totalBuyIn)}</dd>
          <dt className="text-faint">Left in the bank</dt>
          <dd className={`text-right ${check.bankRemaining < 0 ? 'text-bad' : ''}`}>
            {formatMoney(check.bankRemaining)}
          </dd>
        </dl>
      </Panel>

      {check.warnings.length > 0 && (
        <ul className="flex flex-col gap-1 rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn lg:col-span-2">
          {check.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}

      <Button
        variant="primary"
        size="lg"
        fullWidth
        className="lg:col-span-2 lg:mx-auto lg:max-w-sm"
        onClick={start}
      >
        Start game
      </Button>

      {showErrors && check.hasErrors && (
        <p className="text-center text-xs text-bad lg:col-span-2">
          Fix the highlighted fields above.
        </p>
      )}
    </div>
  )
}
