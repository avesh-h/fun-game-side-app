import { useRegisterSW } from 'virtual:pwa-register/react'

/**
 * Offers a new version instead of switching to it on its own.
 *
 * Installed copies run from the cached build. When a newer one has been
 * downloaded this asks before reloading, so an update can never land in the
 * middle of a hand or a vote. Both games save their progress, so accepting
 * mid-game is safe too.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    // Opened straight from the filesystem, or a browser without service
    // workers — the app runs normally, just not offline.
    onRegisterError: () => {},
  })

  if (!needRefresh) return null

  return (
    <div
      role="status"
      className="safe-b fixed inset-x-0 bottom-0 z-50 flex justify-center px-4 pb-4"
    >
      <div className="flex w-full max-w-md items-center justify-between gap-3 rounded-xl border border-accent/40 bg-raised px-4 py-3 text-sm shadow-lg">
        <span>A new version is ready.</span>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => setNeedRefresh(false)}
            className="rounded-lg px-3 py-1.5 text-xs text-muted active:bg-line"
          >
            Later
          </button>
          <button
            type="button"
            onClick={() => void updateServiceWorker(true)}
            className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-accent-ink active:opacity-80"
          >
            Update
          </button>
        </div>
      </div>
    </div>
  )
}
