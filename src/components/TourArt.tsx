/**
 * Miniature, living copies of the real interface, for the walkthrough.
 *
 * Deliberately not screenshots. Pictures would blur when zoomed, add weight to
 * the bundle, and — the real problem — quietly start lying the first time a
 * button changes. These are built from the same styles as the screens they
 * describe, so they cannot go out of date.
 */

import type { ReactNode } from 'react'

export function Frame({ children }: { readonly children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line-soft bg-bg p-3">
      <div className="flex flex-col gap-1.5">{children}</div>
    </div>
  )
}

/** A player as they appear in the list on the table screen. */
export function ArtRow({
  name,
  stack,
  dealer = false,
  turn = false,
  folded = false,
  allIn = false,
  bet,
  dim = false,
}: {
  readonly name: string
  readonly stack: string
  readonly dealer?: boolean
  readonly turn?: boolean
  readonly folded?: boolean
  readonly allIn?: boolean
  readonly bet?: string
  readonly dim?: boolean
}) {
  return (
    <div
      className={[
        'flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-xs',
        turn
          ? 'border-accent border-l-4 bg-accent-soft font-medium'
          : 'border-line border-l-4 border-l-transparent bg-surface',
        folded ? 'opacity-45' : '',
        dim && !turn ? 'opacity-40' : '',
      ].join(' ')}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span className="w-3 shrink-0 text-center text-[0.625rem] font-semibold text-faint">
          {dealer ? 'D' : ''}
        </span>
        <span className={folded ? 'line-through' : ''}>{name}</span>
        {turn && (
          <span className="rounded border border-accent/50 bg-accent-soft px-1 py-px text-[0.5625rem] font-medium uppercase text-ink">
            their turn
          </span>
        )}
        {allIn && (
          <span className="rounded border border-warn/40 bg-warn/10 px-1 py-px text-[0.5625rem] font-medium uppercase text-warn">
            all-in
          </span>
        )}
        {folded && (
          <span className="text-[0.5625rem] uppercase tracking-wide text-faint">folded</span>
        )}
      </span>

      <span className="tnum flex shrink-0 items-baseline gap-1.5">
        {bet && <span className="rounded bg-raised px-1 py-px text-[0.625rem] text-muted">{bet}</span>}
        <span>{stack}</span>
      </span>
    </div>
  )
}

/** The pot panel, with optional side-pot breakdown. */
export function ArtPot({
  round = 'Pre-flop',
  roundStep,
  amount,
  toMatch,
  sides,
}: {
  readonly round?: string
  readonly roundStep?: string
  readonly amount: string
  readonly toMatch?: string
  readonly sides?: readonly { readonly label: string; readonly who: string; readonly amount: string }[]
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-accent">
            {round}
          </p>
          {roundStep && <p className="text-[0.625rem] text-faint">{roundStep}</p>}
        </div>
        <div className="text-right">
          <p className="text-[0.625rem] uppercase tracking-wider text-faint">Pot</p>
          <p className="tnum text-xl font-semibold leading-tight">{amount}</p>
        </div>
      </div>

      {toMatch && (
        <p className="mt-1.5 border-t border-line-soft pt-1.5 text-[0.625rem] text-muted">
          <span className="tnum">{toMatch}</span> to match
        </p>
      )}

      {sides && (
        <ul className="mt-1.5 flex flex-col gap-0.5 border-t border-line-soft pt-1.5">
          {sides.map((side) => (
            <li key={side.label} className="flex justify-between gap-2 text-[0.625rem] text-faint">
              <span>
                {side.label} <span className="opacity-70">· {side.who}</span>
              </span>
              <span className="tnum text-muted">{side.amount}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export type ArtAction = 'fold' | 'check' | 'call' | 'raise' | 'allin'

/** The action buttons, with one optionally picked out. */
export function ArtActions({
  name = 'userB',
  status = 'nothing to call',
  highlight,
  mode = 'check',
}: {
  readonly name?: string
  readonly status?: string
  readonly highlight?: ArtAction
  readonly mode?: 'check' | 'call'
}) {
  const button = (key: ArtAction, label: string, tone: 'danger' | 'primary' | 'default') => {
    const lit = !highlight || highlight === key
    const tones = {
      danger: 'border-bad/45 bg-bad/10 text-bad',
      primary: 'border-accent bg-accent text-accent-ink font-semibold',
      default: 'border-line bg-raised text-ink',
    }
    return (
      <span
        className={[
          'flex min-h-8 items-center justify-center rounded-lg border px-2 text-[0.6875rem]',
          tones[tone],
          lit ? '' : 'opacity-25',
          highlight === key ? 'ring-2 ring-accent ring-offset-2 ring-offset-bg' : '',
        ].join(' ')}
      >
        {label}
      </span>
    )
  }

  return (
    <div className="rounded-lg border border-line bg-surface p-2.5">
      <p className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{name}</span>
        <span className="text-[0.625rem] text-faint">{status}</span>
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {button('fold', 'Fold', 'danger')}
        {mode === 'check'
          ? button('check', 'Check', 'primary')
          : button('call', 'Call 150', 'primary')}
        {button('raise', mode === 'check' ? 'Bet…' : 'Raise…', 'default')}
        {button('allin', 'All-in 800', 'default')}
      </div>
    </div>
  )
}

/** A card as shown in the comparison tool. */
export function ArtCard({ label, red = false }: { readonly label: string; readonly red?: boolean }) {
  return (
    <span
      className={[
        'flex h-7 w-8 shrink-0 items-center justify-center rounded border border-line bg-raised text-[0.6875rem]',
        red ? 'text-suit-red' : 'text-suit-black',
      ].join(' ')}
    >
      {label}
    </span>
  )
}

/** A generic labelled button, for pointing at one control. */
export function ArtButton({
  label,
  tone = 'default',
}: {
  readonly label: string
  readonly tone?: 'default' | 'primary' | 'warn'
}) {
  const tones = {
    default: 'border-line bg-raised text-ink',
    primary: 'border-accent bg-accent text-accent-ink font-semibold',
    warn: 'border-warn/50 bg-warn-soft text-warn',
  }
  return (
    <span
      className={`inline-flex min-h-9 items-center justify-center rounded-lg border px-3 text-xs ${tones[tone]}`}
    >
      {label}
    </span>
  )
}
