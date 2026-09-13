import { useState } from 'react'
import { ActionBar } from '../components/ActionBar'
import { AmountSheet } from '../components/AmountSheet'
import { PlayerRow } from '../components/PlayerRow'
import { PotDisplay } from '../components/PotDisplay'
import { RaiseSheet } from '../components/RaiseSheet'
import { WinnerPicker } from '../components/WinnerPicker'
import { legalActions, potTotal } from '../engine/betting'
import { actingPlayerId, describeActionTaken, ev } from '../engine/events'
import { formatMoney, isZero, type Money } from '../engine/money'
import { nextDealerId } from '../engine/seating'
import {
  dealablePlayers,
  entryCost,
  playersShortOfEntry,
  type Player,
  type PlayerId,
} from '../engine/types'
import { useStore } from '../state/StoreProvider'
import { Button } from '../ui/Button'
import { useConfirm } from '../ui/ConfirmDialog'
import { Panel } from '../ui/Panel'

export function Table() {
  const { state, events, dispatch, undo, canUndo, undoLabel, undoStepsInHand } = useStore()
  const { confirm, dialog } = useConfirm()

  const [raiseOpen, setRaiseOpen] = useState(false)
  const [override, setOverride] = useState(false)
  const [rebuyFor, setRebuyFor] = useState<Player | null>(null)

  const hand = state.hand
  const legal = legalActions(state)
  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?'

  const canDeal = !hand && state.phase === 'playing' && dealablePlayers(state).length >= 2

  // Between hands the marker points at whoever is about to deal, not whoever
  // dealt last. Showing the previous dealer made it look like the marker jumped
  // the moment you pressed Deal.
  const upcomingDealer = canDeal ? nextDealerId(state) : null

  // Between hands, anyone who cannot cover the entry has to do something before
  // the next deal. Asking here saves a trip to the Players screen every time,
  // and means nobody is quietly left out of a hand.
  const entry = entryCost(state.config)
  const short = hand ? [] : playersShortOfEntry(state)

  // Confirmation of the previous tap. Without it there is no way to tell that
  // a Check landed on the player you meant.
  const lastAction = (() => {
    const last = events[events.length - 1]
    if (!last) return null
    const who = actingPlayerId(last)
    const what = describeActionTaken(last)
    return who && what ? `${nameOf(who)} ${what}` : null
  })()

  return (
    <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-5">
      {/* Left on a wide screen, top on a narrow one: what is happening. */}
      <div className="flex min-w-0 flex-col gap-3">
        {override && (
          <p className="rounded-lg border border-warn/50 bg-warn-soft px-3 py-2 text-xs text-warn">
            <strong className="font-semibold">Rules override is on.</strong> Bet and raise
            sizes are not being checked. Turn it off when the odd hand is done.
          </p>
        )}

        {hand ? (
          <PotDisplay state={state} hand={hand} />
        ) : (
          <Panel>
            <div className="flex items-baseline justify-between">
              <span className="text-xs uppercase tracking-wider text-faint">Between hands</span>
              <span className="tnum text-sm text-muted">{state.history.length} played</span>
            </div>
            {upcomingDealer && (
              <p className="mt-2 border-t border-line-soft pt-2 text-xs text-faint">
                <strong className="font-medium text-muted">{nameOf(upcomingDealer)}</strong> deals
                next — marked <span className="font-semibold">D</span> below. The deal moves one
                seat each hand.
              </p>
            )}
          </Panel>
        )}

        <ul className="flex flex-col gap-1.5">
          {state.players
            .filter((p) => p.status !== 'left')
            .map((player) => (
              <PlayerRow
                key={player.id}
                player={player}
                inHand={hand?.players.find((p) => p.playerId === player.id)}
                isDealer={hand ? hand.dealerId === player.id : upcomingDealer === player.id}
                isToAct={hand?.toActId === player.id}
              />
            ))}
        </ul>

        {short.map((player) => (
          <Panel key={player.id} className="border-warn/40 bg-warn-soft">
            <p className="text-sm text-warn">
              <strong className="font-semibold">{player.name}</strong>
              {player.stack === 0
                ? ' has no chips left.'
                : ` has ${formatMoney(player.stack)} — not enough for the ${formatMoney(entry)} it costs to be dealt in.`}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {/* The usual amount is one tap; anything else opens the sheet. */}
              <Button
                size="sm"
                variant="primary"
                disabled={state.config.defaultBuyIn > state.bank}
                onClick={() => dispatch(ev.reBought(player.id, state.config.defaultBuyIn))}
              >
                Re-buy {formatMoney(state.config.defaultBuyIn)}
              </Button>
              <Button size="sm" onClick={() => setRebuyFor(player)}>
                Other amount…
              </Button>
              <Button size="sm" variant="ghost" onClick={() => dispatch(ev.satOut(player.id))}>
                Sit out
              </Button>
            </div>
          </Panel>
        ))}

        {state.phase === 'ended' && (
          <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-ink">
            Session ended. The final numbers are on the Totals screen.
          </p>
        )}

        {!hand && state.phase === 'playing' && !canDeal && (
          <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
            Two players need chips before a hand can be dealt. Someone has to re-buy from the
            bank on the Players screen.
          </p>
        )}
      </div>

      {/* Right on a wide screen, below on a narrow one: what you can do. It
          stays put while the player list scrolls past it. */}
      {/* The DOM order is the phone order, where the action bar has to come
          last to sit under the thumb. On a wide screen `order` lifts it to the
          top of the sidebar, above the occasional controls. */}
      <aside className="flex flex-col gap-3 lg:sticky lg:top-28">
        {canDeal && (
          <Button
            variant="primary"
            size="lg"
            fullWidth
            className="lg:order-1"
            onClick={() => dispatch(ev.handStarted(nextDealerId(state)))}
          >
            Deal hand {state.history.length + 1}
          </Button>
        )}

        {hand?.phase === 'awaitingWinner' && (
          <div className="lg:order-2">
            <WinnerPicker
              state={state}
              hand={hand}
              onAward={(winnersByPot, wentToShowdown) =>
                dispatch(ev.potAwarded(winnersByPot, wentToShowdown))
              }
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 lg:order-4">
          <Button size="sm" disabled={!canUndo} onClick={undo}>
            Undo{undoLabel ? ` · ${undoLabel}` : ''}
          </Button>

          {undoStepsInHand > 0 && (
            <span className="text-[0.6875rem] text-faint">
              {undoStepsInHand} step{undoStepsInHand === 1 ? '' : 's'} back to the start of this
              hand
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2 lg:order-5">
          <Button
            size="sm"
            variant={override ? 'danger' : 'ghost'}
            aria-pressed={override}
            onClick={() => setOverride((on) => !on)}
          >
            {override ? 'Override ON' : 'Override rules'}
          </Button>

          {hand && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                confirm({
                  title: 'Scrap this hand?',
                  body: 'Everyone gets their chips back and the same dealer deals again. The hand will not appear in the history.',
                  confirmLabel: 'Scrap hand',
                  tone: 'danger',
                  onConfirm: () => dispatch(ev.handCancelled()),
                })
              }
            >
              Scrap hand
            </Button>
          )}
        </div>

        {legal && hand && (
          <ActionBar
            className="lg:order-3"
            legal={legal}
            playerName={nameOf(legal.playerId)}
            override={override}
            lastAction={lastAction}
            onFold={() => dispatch(ev.folded(legal.playerId))}
            onCheck={() => dispatch(ev.checked(legal.playerId))}
            onCall={() => dispatch(ev.called(legal.playerId))}
            onAllIn={() => dispatch(ev.allIn(legal.playerId))}
            onOpenRaise={() => setRaiseOpen(true)}
          />
        )}
      </aside>

      {legal && hand && (
        <RaiseSheet
          open={raiseOpen}
          onClose={() => setRaiseOpen(false)}
          hand={hand}
          legal={legal}
          potTotal={potTotal(hand)}
          playerName={nameOf(legal.playerId)}
          override={override}
          onConfirm={(amount: Money) =>
            dispatch(
              isZero(hand.currentBet)
                ? ev.bet(legal.playerId, amount, override)
                : ev.raised(legal.playerId, amount, override),
            )
          }
        />
      )}

      <AmountSheet
        open={rebuyFor !== null}
        onClose={() => setRebuyFor(null)}
        title={rebuyFor ? `${rebuyFor.name} re-buys` : 'Re-buy'}
        confirmLabel="Take from bank"
        defaultAmount={state.config.defaultBuyIn}
        max={state.bank}
        maxLabel="The bank only has"
        onConfirm={(amount) => {
          if (rebuyFor) dispatch(ev.reBought(rebuyFor.id, amount))
        }}
      />

      {dialog}
    </div>
  )
}
