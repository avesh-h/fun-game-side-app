/**
 * Setup form logic, kept out of the component so it can be tested directly.
 *
 * The form holds strings because that is what people type into. This turns
 * those strings into either a valid game, or a precise list of what is wrong.
 */

import type { SeatedPlayer } from '../engine/events'
import { add, parseMoney, sum, ZERO, type Money } from '../engine/money'
import { playerId, type GameConfig } from '../engine/types'

export interface PlayerDraft {
  /** Stable across edits; becomes the player's id. */
  readonly key: string
  readonly name: string
  readonly buyIn: string
}

export interface SetupDraft {
  readonly bank: string
  readonly boot: string
  /** Table charge per player per hand. "0" or blank means none. */
  readonly rake: string
  readonly minBet: string
  readonly defaultBuyIn: string
  readonly players: readonly PlayerDraft[]
}

export interface SetupErrors {
  readonly bank?: string
  readonly boot?: string
  readonly rake?: string
  readonly minBet?: string
  readonly defaultBuyIn?: string
  readonly players?: string
  readonly byPlayer: Readonly<Record<string, string>>
}

export interface ValidatedSetup {
  readonly errors: SetupErrors
  /** Things that are odd but allowed. Shown, never blocking. */
  readonly warnings: readonly string[]
  readonly totalBuyIn: Money
  readonly bankRemaining: Money
  /** Boot plus table charge — what each player needs just to be dealt in. */
  readonly entryCost: Money
  readonly hasErrors: boolean
  /** Populated only when the whole form is valid. */
  readonly ready: {
    readonly config: GameConfig
    readonly players: readonly SeatedPlayer[]
  } | null
}

export function blankPlayer(key: string, buyIn: string): PlayerDraft {
  return { key, name: '', buyIn }
}

export function defaultDraft(keys: readonly string[]): SetupDraft {
  return {
    bank: '100000',
    boot: '20',
    rake: '0',
    minBet: '20',
    defaultBuyIn: '1000',
    players: keys.map((key) => blankPlayer(key, '1000')),
  }
}

/** Reads an amount that is allowed to be zero, unlike the others. */
function optionalAmount(raw: string, what: string): { value: Money; error?: string } {
  if (raw.trim() === '') return { value: ZERO }
  const parsed = parseMoney(raw)
  if (parsed === null) return { value: ZERO, error: `Enter ${what} as a whole number` }
  if (parsed < 0) return { value: ZERO, error: `${what} cannot be negative` }
  return { value: parsed }
}

/** Reads a positive whole amount, or explains why it could not. */
function positiveAmount(raw: string, what: string): { value: Money | null; error?: string } {
  const parsed = parseMoney(raw)
  if (parsed === null) return { value: null, error: `Enter ${what} as a whole number` }
  if (parsed <= 0) return { value: null, error: `${what} must be more than zero` }
  return { value: parsed }
}

export function validateSetup(draft: SetupDraft): ValidatedSetup {
  const byPlayer: Record<string, string> = {}
  const warnings: string[] = []

  const bank = positiveAmount(draft.bank, 'the bank')
  const boot = positiveAmount(draft.boot, 'the boot')
  const rake = optionalAmount(draft.rake, 'the table charge')
  const minBet = positiveAmount(draft.minBet, 'the minimum bet')
  const defaultBuyIn = positiveAmount(draft.defaultBuyIn, 'the default buy-in')

  // What a player must have just to be dealt in. Anyone starting below this
  // could not play a single hand, so it is refused rather than warned about.
  const entry = add(boot.value ?? ZERO, rake.value)

  // Names are how players are told apart on every screen, so duplicates are
  // refused rather than silently allowed.
  const seenNames = new Map<string, number>()
  for (const player of draft.players) {
    const key = player.name.trim().toLowerCase()
    if (key) seenNames.set(key, (seenNames.get(key) ?? 0) + 1)
  }

  const buyIns: Money[] = []

  for (const player of draft.players) {
    const name = player.name.trim()
    if (!name) {
      byPlayer[player.key] = 'Needs a name'
    } else if ((seenNames.get(name.toLowerCase()) ?? 0) > 1) {
      byPlayer[player.key] = 'Two players cannot share a name'
    }

    const amount = positiveAmount(player.buyIn, 'a starting amount')
    if (amount.value === null) {
      byPlayer[player.key] ??= amount.error ?? 'Invalid amount'
    } else {
      buyIns.push(amount.value)
      if (boot.value !== null && entry > 0 && amount.value < entry) {
        byPlayer[player.key] ??=
          `Needs at least ${entry} to be dealt in` +
          (rake.value > 0 ? ` (boot ${boot.value} + charge ${rake.value})` : '')
      } else if (boot.value !== null && entry > 0 && amount.value < add(entry, entry)) {
        warnings.push(
          `${name || 'A player'} can only afford one hand before needing to borrow.`,
        )
      }
    }
  }

  const totalBuyIn = sum(buyIns)
  const bankRemaining = bank.value === null ? ZERO : ((bank.value - totalBuyIn) as Money)

  let bankError = bank.error
  if (!bankError && bank.value !== null && totalBuyIn > bank.value) {
    bankError = `Players are taking ${totalBuyIn} but the bank only holds ${bank.value}`
  }

  const playersError =
    draft.players.length < 2 ? 'A game needs at least two players' : undefined

  const errors: SetupErrors = {
    ...(bankError ? { bank: bankError } : {}),
    ...(boot.error ? { boot: boot.error } : {}),
    ...(rake.error ? { rake: rake.error } : {}),
    ...(minBet.error ? { minBet: minBet.error } : {}),
    ...(defaultBuyIn.error ? { defaultBuyIn: defaultBuyIn.error } : {}),
    ...(playersError ? { players: playersError } : {}),
    byPlayer,
  }

  const hasErrors =
    Boolean(
      bankError || boot.error || rake.error || minBet.error || defaultBuyIn.error || playersError,
    ) || Object.keys(byPlayer).length > 0

  const ready =
    !hasErrors && bank.value !== null && boot.value !== null && minBet.value !== null && defaultBuyIn.value !== null
      ? {
          config: {
            initialBank: bank.value,
            boot: boot.value,
            rake: rake.value,
            minBet: minBet.value,
            defaultBuyIn: defaultBuyIn.value,
          },
          players: draft.players.map((player) => ({
            id: playerId(player.key),
            name: player.name.trim(),
            buyIn: parseMoney(player.buyIn) ?? ZERO,
          })),
        }
      : null

  return { errors, warnings, totalBuyIn, bankRemaining, entryCost: entry, hasErrors, ready }
}
