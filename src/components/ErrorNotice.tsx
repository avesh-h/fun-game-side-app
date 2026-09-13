import { useStore } from '../state/StoreProvider'

/**
 * Shows why an action was refused.
 *
 * The rules engine rejects illegal moves rather than letting them through, so
 * this is how a player finds out that checking is not allowed with a bet in
 * front of them. It is informative, not an error — nothing has broken.
 */
export function ErrorNotice() {
  const { lastError, dismissError } = useStore()
  if (!lastError) return null

  return (
    <div
      role="status"
      className="flex items-start justify-between gap-3 rounded-lg border border-warn/40 bg-warn-soft px-3 py-2.5 text-sm text-warn"
    >
      <span>{lastError}</span>
      <button
        type="button"
        onClick={dismissError}
        className="-my-1 -mr-1 shrink-0 px-2 py-1 text-xs underline"
      >
        Dismiss
      </button>
    </div>
  )
}
