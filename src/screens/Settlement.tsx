import { ev } from '../engine/events'
import { formatMoney, formatSigned } from '../engine/money'
import { settle } from '../engine/settlement'
import { useStore } from '../state/StoreProvider'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { useConfirm } from '../ui/ConfirmDialog'
import { Panel, PanelTitle } from '../ui/Panel'

export function Settlement() {
  const { state, dispatch, newGame } = useStore()
  const { confirm, dialog } = useConfirm()

  const result = settle(state)
  const ended = state.phase === 'ended'

  return (
    <div className="flex flex-col gap-3">
      {ended && (
        <p className="rounded-lg border border-accent/40 bg-accent-soft px-3 py-2 text-xs text-ink">
          Session ended. These are the final numbers — no more hands can be dealt.
        </p>
      )}

      {result.handInProgress && (
        <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
          A hand is still running, so these are provisional.{' '}
          <span className="tnum">{formatMoney(result.potInPlay)}</span> is in the middle and
          belongs to nobody yet.
        </p>
      )}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-4">
      <Panel padded={false}>
        <div className="px-4 pt-4">
          <PanelTitle>Who is up, who is down</PanelTitle>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wider text-faint">
              <th className="px-4 pb-1 text-left font-medium">Player</th>
              <th className="pb-1 text-right font-medium">Took</th>
              <th className="pb-1 text-right font-medium">Has</th>
              <th className="px-4 pb-1 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody>
            {result.standings.map((standing) => (
              <tr key={standing.player.id} className="border-t border-line-soft">
                <td className="px-4 py-2">
                  <span className="flex items-center gap-2">
                    <span className="truncate">{standing.player.name}</span>
                    {standing.player.status === 'left' && <Badge tone="quiet">Left</Badge>}
                    {standing.player.status === 'sittingOut' && <Badge tone="quiet">Out</Badge>}
                  </span>
                </td>
                <td className="tnum py-2 text-right text-muted">
                  {formatMoney(standing.tookFromBank)}
                </td>
                <td className="tnum py-2 text-right text-muted">
                  {formatMoney(standing.finishedWith)}
                </td>
                <td
                  className={`tnum px-4 py-2 text-right font-medium ${
                    standing.net > 0 ? 'text-good' : standing.net < 0 ? 'text-bad' : 'text-faint'
                  }`}
                >
                  {formatSigned(standing.net)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel>
        <PanelTitle>Does it all add up?</PanelTitle>

        <dl className="tnum grid grid-cols-2 gap-y-1 text-sm">
          <dt className="text-faint">Bank</dt>
          <dd className="text-right">{formatMoney(result.bank)}</dd>

          <dt className="text-faint">In front of players</dt>
          <dd className="text-right">{formatMoney(result.liveStacks)}</dd>

          {result.potInPlay > 0 && (
            <>
              <dt className="text-faint">In the middle</dt>
              <dd className="text-right">{formatMoney(result.potInPlay)}</dd>
            </>
          )}

          {result.totalRaked > 0 && (
            <>
              <dt className="text-faint">Table charge to the bank</dt>
              <dd className="text-right">{formatMoney(result.totalRaked)}</dd>
            </>
          )}

          <dt className="border-t border-line-soft pt-1 font-medium">Accounted for</dt>
          <dd className="border-t border-line-soft pt-1 text-right font-medium">
            {formatMoney(result.accountedFor)}
          </dd>

          <dt className="text-faint">Bank ever issued</dt>
          <dd className="text-right text-faint">{formatMoney(result.totalIssued)}</dd>
        </dl>

        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            result.balances
              ? 'border border-good/30 bg-good/10 text-good'
              : 'border border-bad/40 bg-bad/10 text-bad'
          }`}
        >
          {result.balances ? (
            result.totalRaked > 0 ? (
              <>
                Every chip is accounted for. The results come to exactly minus the{' '}
                {formatMoney(result.totalRaked)} the table charge returned to the bank, which
                is the books balancing correctly.
              </>
            ) : (
              <>
                Every chip is accounted for, and the results come to exactly zero. The night
                was recorded correctly.
              </>
            )
          ) : (
            <>
              The books do not balance. Something has gone wrong in the app — please say what you
              were doing when it happened.
            </>
          )}
        </p>
      </Panel>
      </div>

      <Panel className="lg:max-w-md">
        <PanelTitle>Finishing up</PanelTitle>

        <div className="flex flex-col gap-2">
          {!ended && (
            <Button
              fullWidth
              disabled={result.handInProgress}
              onClick={() =>
                confirm({
                  title: 'Call it a night?',
                  body: 'These totals stay on screen, but no more hands can be dealt. Everything played is kept.',
                  confirmLabel: 'End session',
                  onConfirm: () => dispatch(ev.sessionEnded()),
                })
              }
            >
              End session
            </Button>
          )}

          <Button
            variant="danger"
            fullWidth
            onClick={() =>
              confirm({
                title: 'Throw this game away and start again?',
                body: 'Everything goes — every stack, every hand played, these totals, and the copy saved in this browser. You will be taken back to the setup screen. This cannot be undone.',
                confirmLabel: 'Wipe it and start over',
                tone: 'danger',
                onConfirm: newGame,
              })
            }
          >
            Start a new game
          </Button>

          <p className="text-xs text-faint">
            {result.handInProgress
              ? 'Finish or scrap the hand in progress before ending the session.'
              : 'Ending the session keeps everything and stops the dealing. A new game erases it all.'}
          </p>
        </div>
      </Panel>

      {dialog}
    </div>
  )
}
