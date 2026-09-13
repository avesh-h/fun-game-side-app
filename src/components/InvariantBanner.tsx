import { formatMoney } from '../engine/money'
import { useStore } from '../state/StoreProvider'

/**
 * The thing you hope never appears.
 *
 * If the money stops adding up, that is a bug in this app, not a mistake at
 * the table — and continuing to play would only bury it deeper. So it is shown
 * at the top of every screen, in red, with the actual numbers, rather than
 * being written to a console nobody is looking at.
 */
export function InvariantBanner() {
  const { invariant } = useStore()
  if (invariant.ok) return null

  return (
    <div
      role="alert"
      className="rounded-lg border border-bad/50 bg-bad/10 px-3 py-2.5 text-sm text-bad"
    >
      <p className="font-semibold">The money no longer balances</p>

      <ul className="mt-1 list-disc space-y-0.5 pl-4 text-bad/90">
        {invariant.problems.map((problem) => (
          <li key={problem}>{problem}</li>
        ))}
      </ul>

      <dl className="tnum mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs text-bad/80">
        <dt>Bank</dt>
        <dd className="text-right">{formatMoney(invariant.bank)}</dd>
        <dt>All stacks</dt>
        <dd className="text-right">{formatMoney(invariant.stacks)}</dd>
        <dt>In the middle</dt>
        <dd className="text-right">{formatMoney(invariant.pot)}</dd>
        <dt className="font-semibold">Should be</dt>
        <dd className="text-right font-semibold">{formatMoney(invariant.expected)}</dd>
      </dl>

      <p className="mt-2 text-xs text-bad/80">
        Undo the last action to get back to a good state, and please report what you did.
      </p>
    </div>
  )
}
