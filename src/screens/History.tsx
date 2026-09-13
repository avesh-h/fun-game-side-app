import { useState } from 'react'
import { formatMoney, formatSigned, money, sub, sum, type Money } from '../engine/money'
import { ROUND_LABELS, type HandRecord, type PlayerId } from '../engine/types'
import { useStore } from '../state/StoreProvider'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useConfirm } from '../ui/ConfirmDialog'
import { EmptyState, Panel } from '../ui/Panel'

export function History() {
  const { state, canScrapLastHand, scrapLastHand } = useStore()
  const { confirm, dialog } = useConfirm()
  const [openHand, setOpenHand] = useState<number | null>(null)

  const nameOf = (id: PlayerId) => state.players.find((p) => p.id === id)?.name ?? '?'

  if (state.history.length === 0) {
    return (
      <EmptyState
        title="No hands played yet."
        detail="Every hand is recorded here once it is paid out — what everyone put in, the pot, and who took it."
      />
    )
  }

  // Newest first: the hand people are still arguing about is the recent one.
  const records = [...state.history].reverse()
  const latest = records[0]
  const handInProgress = state.hand !== null

  const awardTo = (record: HandRecord, id: PlayerId): Money =>
    sum(record.awards.filter((a) => a.playerId === id).map((a) => a.amount))

  const contributionOf = (record: HandRecord, id: PlayerId): Money =>
    sum(record.contributions.filter((c) => c.playerId === id).map((c) => c.amount))

  return (
    <div className="flex flex-col gap-3">
      <Panel>
        <div className="flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wider text-faint">Hands played</span>
          <span className="tnum text-2xl font-semibold">{state.history.length}</span>
        </div>
      </Panel>

      <ul className="grid gap-2 lg:grid-cols-2">
        {records.map((record) => {
          const expanded = openHand === record.number
          const winners = record.awards.map((a) => nameOf(a.playerId))
          const everyone = [
            ...new Set([
              ...record.contributions.map((c) => c.playerId),
              ...record.awards.map((a) => a.playerId),
            ]),
          ]

          return (
            <li key={record.number}>
              <Panel padded={false}>
                <button
                  type="button"
                  aria-expanded={expanded}
                  onClick={() => setOpenHand(expanded ? null : record.number)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm">
                      <span className="font-medium">Hand {record.number}</span>
                      {!record.wentToShowdown && <Badge tone="quiet">No showdown</Badge>}
                      {record.awards.length > 1 && <Badge tone="good">Split</Badge>}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-faint">
                      {winners.join(' and ')} · {ROUND_LABELS[record.endedAtRound]}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-2">
                    <span className="tnum text-base">{formatMoney(record.totalPot)}</span>
                    <span className="text-faint">{expanded ? '▴' : '▾'}</span>
                  </span>
                </button>

                {expanded && (
                  <div className="border-t border-line-soft px-4 py-3">
                    <dl className="tnum mb-3 grid grid-cols-2 gap-y-1 text-xs text-faint">
                      <dt>Boot each</dt>
                      <dd className="text-right">{formatMoney(record.boot)}</dd>
                      <dt>Dealer</dt>
                      <dd className="text-right">{nameOf(record.dealerId)}</dd>
                    </dl>

                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs uppercase tracking-wider text-faint">
                          <th className="pb-1 text-left font-medium">Player</th>
                          <th className="pb-1 text-right font-medium">Put in</th>
                          <th className="pb-1 text-right font-medium">Took</th>
                          <th className="pb-1 text-right font-medium">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {everyone.map((id) => {
                          const put = contributionOf(record, id)
                          const took = awardTo(record, id)
                          const net = sub(took, put)
                          return (
                            <tr key={id} className="border-t border-line-soft">
                              <td className="py-1.5">{nameOf(id)}</td>
                              <td className="tnum py-1.5 text-right text-muted">
                                {formatMoney(put)}
                              </td>
                              <td className="tnum py-1.5 text-right text-muted">
                                {took > 0 ? formatMoney(took) : '—'}
                              </td>
                              <td
                                className={`tnum py-1.5 text-right ${
                                  net > 0 ? 'text-good' : net < 0 ? 'text-bad' : 'text-faint'
                                }`}
                              >
                                {formatSigned(net)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-line">
                          <td className="pt-1.5 text-xs text-faint">Pot</td>
                          <td className="tnum pt-1.5 text-right text-xs text-faint">
                            {formatMoney(record.totalPot)}
                          </td>
                          <td className="tnum pt-1.5 text-right text-xs text-faint">
                            {formatMoney(sum(record.awards.map((a) => a.amount)))}
                          </td>
                          <td className="tnum pt-1.5 text-right text-xs text-faint">
                            {formatMoney(money(0))}
                          </td>
                        </tr>
                      </tfoot>
                    </table>

                    {record.number === latest?.number && !handInProgress && canScrapLastHand && (
                      <Button
                        className="mt-3"
                        size="sm"
                        variant="danger"
                        fullWidth
                        onClick={() =>
                          confirm({
                            title: `Scrap hand ${record.number}?`,
                            body: 'Rewinds to just before this hand was dealt. Anything since — re-buys, people joining — is undone with it.',
                            confirmLabel: 'Scrap it',
                            tone: 'danger',
                            onConfirm: scrapLastHand,
                          })
                        }
                      >
                        Scrap this hand
                      </Button>
                    )}

                    {record.number !== latest?.number && (
                      <p className="mt-3 text-xs text-faint">
                        Only the most recent hand can be scrapped. Every hand since this one was
                        played against the stacks it produced.
                      </p>
                    )}
                  </div>
                )}
              </Panel>
            </li>
          )
        })}
      </ul>

      {dialog}
    </div>
  )
}
