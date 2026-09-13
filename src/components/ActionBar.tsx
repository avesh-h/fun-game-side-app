import type { LegalActions } from '../engine/betting'
import { formatMoney } from '../engine/money'
import { Button } from '../ui/Button'

interface ActionBarProps {
  readonly legal: LegalActions
  readonly playerName: string
  readonly override: boolean
  /** What happened on the previous tap, e.g. "userB checked". */
  readonly lastAction: string | null
  readonly className?: string
  readonly onFold: () => void
  readonly onCheck: () => void
  readonly onCall: () => void
  readonly onOpenRaise: () => void
  readonly onAllIn: () => void
}

/**
 * Pinned to the bottom of the screen, where a thumb already is.
 *
 * Every button carries its own amount, so the common actions are a single tap
 * with nothing to read and nothing to calculate. Only a bet or raise needs a
 * second screen, because only those need a number choosing.
 */
export function ActionBar({
  legal,
  playerName,
  override,
  lastAction,
  className = '',
  onFold,
  onCheck,
  onCall,
  onOpenRaise,
  onAllIn,
}: ActionBarProps) {
  const opening = legal.canBet
  const canOpenRaiseSheet = override ? legal.canBet || legal.canCall : legal.canBet || legal.canRaise

  return (
    <div
      className={[
        // On a phone this is a bar welded to the bottom of the screen, under
        // the thumb. On a wide screen there is room for it to live in the
        // sidebar as an ordinary panel, so it stops covering the table.
        'safe-b sticky bottom-0 -mx-4 -mb-4 border-t border-line bg-bg/95 px-4 pb-4 pt-3 backdrop-blur',
        'lg:static lg:mx-0 lg:mb-0 lg:rounded-xl lg:border lg:bg-surface lg:p-4',
        className,
      ].join(' ')}
    >
      {/* Whose turn it is has to be unmissable. Everything below acts on this
          person, and the operator never chooses who — the turn moves itself. */}
      <div className="mb-2 flex items-end justify-between gap-3">
        <p className="min-w-0">
          <span className="block truncate text-lg font-semibold leading-tight text-ink">
            {playerName}
          </span>
          <span className="block text-xs text-faint">
            {legal.canCheck ? (
              'nothing to call'
            ) : (
              <>
                to call <span className="tnum text-muted">{formatMoney(legal.callAmount)}</span>
                {legal.callIsAllIn && ' — all-in'}
              </>
            )}
          </span>
        </p>

        {lastAction && (
          <p className="shrink-0 text-right text-[0.6875rem] leading-tight text-faint">
            just now
            <br />
            <span className="text-muted">{lastAction}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="danger" size="lg" onClick={onFold}>
          Fold
        </Button>

        {legal.canCheck ? (
          <Button variant="primary" size="lg" onClick={onCheck}>
            Check
          </Button>
        ) : (
          <Button variant="primary" size="lg" disabled={!legal.canCall} onClick={onCall}>
            Call {formatMoney(legal.callAmount)}
          </Button>
        )}

        <Button size="lg" disabled={!canOpenRaiseSheet} onClick={onOpenRaise}>
          {opening ? 'Bet…' : 'Raise…'}
        </Button>

        <Button size="lg" disabled={!legal.canAllIn} onClick={onAllIn}>
          All-in {formatMoney(legal.allInTo)}
        </Button>
      </div>

      {/* Says in plain words what this player is actually facing, so nobody has
          to know what "check" means to use the app. */}
      <p className="mt-2 text-center text-[0.6875rem] leading-snug text-faint">
        {legal.raiseBlockedReason && !override
          ? legal.raiseBlockedReason
          : legal.canCheck
            ? 'Nobody has bet yet — checking costs nothing and keeps them in.'
            : legal.callIsAllIn
              ? `Calling puts their last ${formatMoney(legal.callAmount)} in.`
              : `They pay ${formatMoney(legal.callAmount)} to stay in, or fold and lose what is already in.`}
      </p>
    </div>
  )
}
