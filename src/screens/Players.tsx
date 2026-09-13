import { useState } from 'react'
import { AmountSheet } from '../components/AmountSheet'
import { ev } from '../engine/events'
import { formatMoney, formatSigned, money } from '../engine/money'
import { netResult } from '../engine/settlement'
import { makeId } from '../state/ids'
import { useStore } from '../state/StoreProvider'
import { playerId, type Player, type PlayerId } from '../engine/types'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useConfirm } from '../ui/ConfirmDialog'
import { Panel, PanelTitle } from '../ui/Panel'

type Sheet =
  | { readonly kind: 'rebuy'; readonly player: Player }
  | { readonly kind: 'add' }
  | { readonly kind: 'topUp' }
  | null

export function Players() {
  const { state, dispatch } = useStore()
  const { confirm, dialog } = useConfirm()
  const [sheet, setSheet] = useState<Sheet>(null)

  const seated = state.players.filter((p) => p.status !== 'left')
  const gone = state.players.filter((p) => p.status === 'left')

  /**
   * Chips cannot move in or out mid-hand — that is the table-stakes rule, and
   * it also stops the side-pot maths being invalidated part-way through. The
   * buttons go quiet rather than failing when tapped.
   */
  const lockedInHand = (id: PlayerId): boolean => {
    const inHand = state.hand?.players.find((p) => p.playerId === id)
    return Boolean(inHand && inHand.status !== 'folded')
  }

  // Shared with the totals screen, so a player who cashed out ahead is not
  // reported as having lost everything they ever took.
  const netOf = netResult

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <PanelTitle>Bank</PanelTitle>
        <div className="flex items-center justify-between gap-3">
          <span className="tnum text-2xl font-semibold">{formatMoney(state.bank)}</span>
          <Button size="sm" onClick={() => setSheet({ kind: 'topUp' })}>
            Top up
          </Button>
        </div>
        <p className="mt-2 text-xs text-faint">
          Topping up creates new money. Only do it if the bank genuinely runs dry.
        </p>
      </Panel>

      {/* Player cards are self-contained, so on a wider screen they tile
          instead of forming one long ribbon down the middle. */}
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {seated.map((player) => {
          const locked = lockedInHand(player.id)
          const net = netOf(player)
          const broke = player.stack === 0

          return (
            <Panel key={player.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <span className="truncate">{player.name}</span>
                    {player.status === 'sittingOut' && <Badge tone="quiet">Sitting out</Badge>}
                    {broke && player.status === 'active' && <Badge tone="bad">No chips</Badge>}
                  </p>
                  <p className="tnum mt-1 text-xs text-faint">
                    Took {formatMoney(player.totalTakenFromBank)} from the bank
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="tnum text-lg">{formatMoney(player.stack)}</p>
                  <p
                    className={`tnum text-xs ${net > 0 ? 'text-good' : net < 0 ? 'text-bad' : 'text-faint'}`}
                  >
                    {formatSigned(net)}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={broke ? 'primary' : 'default'}
                  disabled={locked}
                  onClick={() => setSheet({ kind: 'rebuy', player })}
                >
                  Re-buy
                </Button>

                {player.status === 'active' ? (
                  <Button
                    size="sm"
                    disabled={locked}
                    onClick={() => dispatch(ev.satOut(player.id))}
                  >
                    Sit out
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => dispatch(ev.satIn(player.id))}>
                    Sit back in
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  disabled={locked}
                  onClick={() =>
                    confirm({
                      title: `${player.name} cashes out?`,
                      body: `Their ${formatMoney(player.stack)} goes back to the bank and they stop being dealt in. They stay on the end-of-night totals.`,
                      confirmLabel: 'Cash out',
                      tone: 'danger',
                      onConfirm: () => dispatch(ev.cashedOut(player.id)),
                    })
                  }
                >
                  Cash out
                </Button>
              </div>

              {locked && (
                <p className="mt-2 text-xs text-faint">
                  In the middle of a hand — chips cannot move until it finishes.
                </p>
              )}
            </Panel>
          )
        })}
      </div>

      <Button className="md:max-w-xs" fullWidth onClick={() => setSheet({ kind: 'add' })}>
        + Add a player
      </Button>

      {gone.length > 0 && (
        <Panel>
          <PanelTitle>Cashed out</PanelTitle>
          <ul className="flex flex-col gap-1.5">
            {gone.map((player) => (
              <li key={player.id} className="flex items-baseline justify-between text-sm">
                <span className="text-muted">{player.name}</span>
                <span className={`tnum text-xs ${netOf(player) >= 0 ? 'text-good' : 'text-bad'}`}>
                  {formatSigned(netOf(player))}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}

      <AmountSheet
        open={sheet?.kind === 'rebuy'}
        onClose={() => setSheet(null)}
        title={sheet?.kind === 'rebuy' ? `${sheet.player.name} re-buys` : 'Re-buy'}
        confirmLabel="Take from bank"
        defaultAmount={state.config.defaultBuyIn}
        max={state.bank}
        maxLabel="The bank only has"
        hint="Added to their stack and recorded against them for the end-of-night totals"
        onConfirm={(amount) => {
          if (sheet?.kind === 'rebuy') dispatch(ev.reBought(sheet.player.id, amount))
        }}
      />

      <AmountSheet
        open={sheet?.kind === 'add'}
        onClose={() => setSheet(null)}
        title="Somebody joining"
        confirmLabel="Sit them down"
        defaultAmount={state.config.defaultBuyIn}
        max={state.bank}
        maxLabel="The bank only has"
        nameField={{ label: 'Name', taken: state.players.map((p) => p.name) }}
        onConfirm={(amount, name) =>
          dispatch(ev.playerAdded({ id: playerId(makeId()), name, buyIn: amount }))
        }
      />

      <AmountSheet
        open={sheet?.kind === 'topUp'}
        onClose={() => setSheet(null)}
        title="Top up the bank"
        confirmLabel="Add to bank"
        defaultAmount={money(10_000)}
        hint="This creates money that did not exist before. The totals will account for it."
        onConfirm={(amount) => dispatch(ev.bankToppedUp(amount))}
      />

      {dialog}
    </div>
  )
}
