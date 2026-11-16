import { useEffect, useState } from 'react'
import { AppShell, CONTAINER, type Screen } from './components/AppShell'
import { ErrorNotice } from './components/ErrorNotice'
import { Walkthrough } from './components/Walkthrough'
import { hasSeenWalkthrough, markWalkthroughSeen } from './state/persistence'
import { Guide } from './screens/Guide'
import { History } from './screens/History'
import { Players } from './screens/Players'
import { Settlement } from './screens/Settlement'
import { Setup } from './screens/Setup'
import { Table } from './screens/Table'
import { StoreProvider, useStore } from './state/StoreProvider'
import { MainMenu, type GameChoice } from './MainMenu'
import { UndercoverApp } from './undercover/UndercoverApp'

// ---------------------------------------------------------------------------
// Poker — exactly the same as before, just moved into its own component
// ---------------------------------------------------------------------------

function PokerScreens({ onBack }: { readonly onBack: () => void }) {
  const { state } = useStore()
  const [screen, setScreen] = useState<Screen>('table')
  const [tourOpen, setTourOpen] = useState(false)

  const setupPhase = state.phase === 'setup'

  useEffect(() => {
    if (setupPhase && !hasSeenWalkthrough()) {
      setTourOpen(true)
      markWalkthroughSeen()
    }
  }, [setupPhase])

  if (setupPhase) {
    return (
      <div
        className={`${CONTAINER} safe-t safe-b flex min-h-full flex-col gap-4 p-4 lg:gap-5 lg:px-6 lg:py-8`}
      >
        <header className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={onBack}
              className="mt-0.5 flex size-9 items-center justify-center rounded-lg border border-line bg-raised text-sm text-muted active:bg-line"
            >
              ←
            </button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight lg:text-2xl">Poker Ledger</h1>
              <p className="text-sm text-muted">
                The chip stack for a real card game. No real money involved.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setTourOpen(true)}
            className="flex shrink-0 items-center gap-2 rounded-lg border border-line bg-raised px-3 py-2 text-xs text-muted active:bg-line"
          >
            <span className="flex size-5 items-center justify-center rounded-full border border-line-soft font-semibold">
              i
            </span>
            How it works
          </button>
        </header>
        <ErrorNotice />
        <Setup />
        <Walkthrough open={tourOpen} onClose={() => setTourOpen(false)} />
      </div>
    )
  }

  return (
    <AppShell screen={screen} onNavigate={setScreen}>
      {screen === 'table' && <Table />}
      {screen === 'players' && <Players />}
      {screen === 'history' && <History />}
      {screen === 'guide' && <Guide />}
      {screen === 'totals' && <Settlement />}
    </AppShell>
  )
}

// ---------------------------------------------------------------------------
// Top-level app — game picker → poker or undercover
// ---------------------------------------------------------------------------

type ActiveGame = 'menu' | 'poker' | 'undercover'

export default function App() {
  const [activeGame, setActiveGame] = useState<ActiveGame>('menu')

  if (activeGame === 'menu') {
    return (
      <MainMenu
        onChoose={(game: GameChoice) => setActiveGame(game)}
      />
    )
  }

  if (activeGame === 'undercover') {
    return <UndercoverApp onBackToMenu={() => setActiveGame('menu')} />
  }

  // Poker — needs its store provider
  return (
    <StoreProvider>
      <PokerScreens onBack={() => setActiveGame('menu')} />
    </StoreProvider>
  )
}
