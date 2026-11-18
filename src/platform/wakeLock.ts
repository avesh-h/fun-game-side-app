/**
 * Keep the screen on while a game is open.
 *
 * The phone sits in the middle of the table and nobody touches it between
 * actions, so it would otherwise dim and lock mid-hand. The browser drops the
 * lock whenever the app goes to the background, so it is re-requested each
 * time the app becomes visible again. Where the API is missing this does
 * nothing and the phone behaves as it always has.
 */

import { useEffect } from 'react'

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return

    let sentinel: WakeLockSentinel | null = null
    let cancelled = false

    const acquire = async () => {
      if (document.visibilityState !== 'visible' || (sentinel && !sentinel.released)) return
      try {
        const lock = await navigator.wakeLock.request('screen')
        if (cancelled) void lock.release()
        else sentinel = lock
      } catch {
        // Battery saver, or the browser said no. The game works without it.
      }
    }

    void acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', acquire)
      void sentinel?.release()
    }
  }, [active])
}
