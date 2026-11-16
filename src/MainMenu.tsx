import { CONTAINER } from './components/AppShell'

export type GameChoice = 'poker' | 'undercover'

export function MainMenu({ onChoose }: { readonly onChoose: (game: GameChoice) => void }) {
  return (
    <div
      className={`${CONTAINER} safe-t safe-b flex min-h-full flex-col items-center justify-center gap-6 p-4 lg:gap-8 lg:px-6 lg:py-10`}
    >
      <div className="text-center">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Game Night</h1>
        <p className="mt-1 text-sm text-muted">Pick a game to play with friends</p>
      </div>

      <div className="grid w-full max-w-md gap-4 sm:grid-cols-2 sm:max-w-lg">
        <button
          type="button"
          onClick={() => onChoose('poker')}
          className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/40 hover:bg-raised active:bg-raised"
        >
          <span className="flex size-14 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            🃏
          </span>
          <div className="text-center">
            <p className="text-base font-semibold">Poker Ledger</p>
            <p className="mt-0.5 text-xs text-muted">
              Chip stack for Texas Hold'em
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onChoose('undercover')}
          className="group flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6 transition-colors hover:border-accent/40 hover:bg-raised active:bg-raised"
        >
          <span className="flex size-14 items-center justify-center rounded-xl bg-accent-soft text-2xl">
            🕵️
          </span>
          <div className="text-center">
            <p className="text-base font-semibold">Undercover</p>
            <p className="mt-0.5 text-xs text-muted">
              Word guessing &amp; social deduction
            </p>
          </div>
        </button>
      </div>
    </div>
  )
}
