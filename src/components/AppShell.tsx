import { useEffect, useState, type ReactNode } from 'react'
import { formatMoney } from '../engine/money'
import { hasSeenWalkthrough, markWalkthroughSeen } from '../state/persistence'
import { useStore } from '../state/StoreProvider'
import { InvariantBanner } from './InvariantBanner'
import { ErrorNotice } from './ErrorNotice'
import { Walkthrough } from './Walkthrough'

export type Screen = 'table' | 'players' | 'history' | 'guide' | 'totals'

const TABS: readonly { readonly id: Screen; readonly label: string }[] = [
  { id: 'table', label: 'Table' },
  { id: 'players', label: 'Players' },
  { id: 'history', label: 'Hands' },
  { id: 'guide', label: 'Guide' },
  { id: 'totals', label: 'Totals' },
]

/**
 * One container width for the whole app.
 *
 * Phones get the full width. From `sm` upwards it widens in steps rather than
 * staying pinned to a phone-sized column, which on a laptop reads as a stripe
 * of content marooned in the middle of the screen. It stops growing at 72rem
 * so that on a very large display the text does not stretch into lines nobody
 * can track.
 */
export const CONTAINER =
  'mx-auto w-full max-w-xl md:max-w-3xl lg:max-w-5xl xl:max-w-6xl 2xl:max-w-7xl'

export function AppShell({
  screen,
  onNavigate,
  onMenu,
  children,
}: {
  readonly screen: Screen
  readonly onNavigate: (next: Screen) => void
  /** Back to the game menu. The ledger is saved, so nothing is lost. */
  readonly onMenu: () => void
  readonly children: ReactNode
}) {
  const { state, storageUnavailable } = useStore()

  // Shown once, unprompted, the first time somebody opens the app. After that
  // it lives behind the ⓘ button — nobody wants to dismiss it every session.
  const [tourOpen, setTourOpen] = useState(false)
  useEffect(() => {
    if (!hasSeenWalkthrough()) {
      setTourOpen(true)
      markWalkthroughSeen()
    }
  }, [])

  return (
    <div className="flex min-h-full w-full flex-col">
      <header className="safe-t sticky top-0 z-30 border-b border-line bg-bg/95 backdrop-blur">
        <div className={`${CONTAINER} px-4 lg:px-6`}>
          <div className="flex items-center justify-between gap-4 pb-2 pt-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onMenu}
                aria-label="Back to game menu"
                className="flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sm text-muted active:bg-line"
              >
                ←
              </button>
              <h1 className="text-sm font-semibold tracking-tight lg:text-base">Poker Ledger</h1>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-xs text-faint lg:text-sm">
                Bank <span className="tnum text-muted">{formatMoney(state.bank)}</span>
              </p>
              <button
                type="button"
                onClick={() => setTourOpen(true)}
                aria-label="How it works"
                className="flex size-9 items-center justify-center rounded-full border border-line bg-raised text-sm font-semibold text-muted active:bg-line"
              >
                i
              </button>
            </div>
          </div>

          <nav aria-label="Screens" className="-mx-1 flex gap-1 overflow-x-auto pb-2">
            {TABS.map((tab) => {
              const active = tab.id === screen
              return (
                <button
                  key={tab.id}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => onNavigate(tab.id)}
                  className={[
                    'min-h-11 shrink-0 rounded-lg px-3 text-xs font-medium transition-colors lg:text-sm',
                    active ? 'bg-accent-soft text-ink' : 'text-faint active:bg-raised hover:text-muted',
                  ].join(' ')}
                >
                  {tab.label}
                </button>
              )
            })}
          </nav>
        </div>
      </header>

      <main className={`${CONTAINER} safe-b flex flex-1 flex-col gap-3 p-4 lg:gap-4 lg:px-6 lg:py-6`}>
        <InvariantBanner />
        <ErrorNotice />

        {storageUnavailable && (
          <p className="rounded-lg border border-warn/30 bg-warn-soft px-3 py-2 text-xs text-warn">
            This browser will not let the app save. The game works fine, but refreshing the
            page will lose it.
          </p>
        )}

        {children}
      </main>

      <Walkthrough open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  )
}
