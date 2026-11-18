/**
 * The Android back button.
 *
 * The app has no router, so the browser history is empty. Installed as an app,
 * pressing Back with an empty history closes it — in the middle of a hand.
 *
 * The fix is a single "guard" history entry pushed while a game is open. Back
 * pops the guard, which fires `popstate`; a registered handler decides what
 * Back means, and the guard is pushed again. On the menu there is no guard, so
 * Back closes the app as people expect.
 *
 * Handlers form a stack. An open popup (layer 'modal') always gets Back before
 * the screen underneath it (layer 'screen'); within a layer the most recently
 * registered wins, so a confirm opened over a sheet closes first.
 */

import { useEffect, useRef } from 'react'

/** Return true if Back was handled here; false passes it further down. */
export type BackHandler = () => boolean

export type BackLayer = 'modal' | 'screen'

interface Entry {
  readonly layer: BackLayer
  readonly call: BackHandler
}

const GUARD = 'gameNightBackGuard'

const stack: Entry[] = []
/** Set while our own history.back() is in flight, so its popstate is not read as a press. */
let expectingOwnPop = false

function isGuardEntry(): boolean {
  return (window.history.state as Record<string, unknown> | null)?.[GUARD] === true
}

function pushGuard(): void {
  if (!isGuardEntry()) window.history.pushState({ [GUARD]: true }, '')
}

/** Offer the entries a Back press, popups first, newest first. */
function runHandlers(): boolean {
  for (const layer of ['modal', 'screen'] as const) {
    for (let i = stack.length - 1; i >= 0; i -= 1) {
      const entry = stack[i]
      if (entry?.layer === layer && entry.call()) return true
    }
  }
  return false
}

/**
 * Take part in deciding what Back does while `enabled` is true.
 * Nothing handling it means the game is left for the menu.
 */
export function useBackHandler(
  handler: BackHandler,
  { layer = 'screen', enabled = true }: { layer?: BackLayer; enabled?: boolean } = {},
): void {
  const ref = useRef(handler)
  useEffect(() => {
    ref.current = handler
  })
  useEffect(() => {
    if (!enabled) return
    const entry: Entry = { layer, call: () => ref.current() }
    stack.push(entry)
    return () => {
      const index = stack.indexOf(entry)
      if (index !== -1) stack.splice(index, 1)
    }
  }, [enabled, layer])
}

/**
 * Installed once, at the top of the app.
 *
 * Returns `leaveGame`, which must be used for every in-app return to the menu:
 * it drops the guard entry too, so the next Back press closes the app instead
 * of silently popping a leftover guard.
 */
export function useBackGuard(inGame: boolean, goToMenu: () => void): () => void {
  const inGameRef = useRef(inGame)
  const goToMenuRef = useRef(goToMenu)
  useEffect(() => {
    goToMenuRef.current = goToMenu
  })

  useEffect(() => {
    inGameRef.current = inGame
    if (inGame) pushGuard()
  }, [inGame])

  useEffect(() => {
    const onPopState = () => {
      if (expectingOwnPop) {
        expectingOwnPop = false
        // Re-entered a game before the pop landed: put the guard back.
        if (inGameRef.current) pushGuard()
        return
      }
      if (!inGameRef.current) return
      const stay = runHandlers()
      if (stay) {
        pushGuard()
      } else {
        inGameRef.current = false
        goToMenuRef.current()
      }
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return () => {
    inGameRef.current = false
    if (isGuardEntry()) {
      expectingOwnPop = true
      window.history.back()
    }
    goToMenuRef.current()
  }
}
