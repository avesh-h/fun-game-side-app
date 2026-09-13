/**
 * Money.
 *
 * Every amount in this app is a whole number. No decimals, no floats, ever.
 * A poker session is thousands of additions and subtractions; if floating point
 * drift gets in, the ledger silently stops balancing and nobody can tell when
 * it started.
 *
 * `Money` is a *branded* number. The brand means a plain `number` cannot be
 * assigned to a `Money` field, and — importantly — neither can the result of
 * `a + b`, because TypeScript widens that back to `number`. So all arithmetic
 * has to go through the checked helpers below. That is the point.
 */

declare const MoneyBrand: unique symbol

export type Money = number & { readonly [MoneyBrand]: true }

export class MoneyError extends Error {
  override name = 'MoneyError'
}

/** Build a Money value, rejecting anything that is not a safe whole number. */
export function money(n: number): Money {
  if (!Number.isFinite(n)) {
    throw new MoneyError(`Amount must be a finite number, got ${n}`)
  }
  if (!Number.isInteger(n)) {
    throw new MoneyError(`Amount must be a whole number, got ${n}`)
  }
  if (!Number.isSafeInteger(n)) {
    throw new MoneyError(`Amount is outside the safe integer range: ${n}`)
  }
  return n as Money
}

export const ZERO: Money = money(0)

/** Parse user input from a text field. Returns null if it is not usable. */
export function parseMoney(input: string): Money | null {
  const cleaned = input.replace(/[\s,]/g, '')
  if (cleaned === '') return null
  if (!/^-?\d+$/.test(cleaned)) return null
  const n = Number(cleaned)
  if (!Number.isSafeInteger(n)) return null
  return n as Money
}

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

export function add(...amounts: readonly Money[]): Money {
  let total = 0
  for (const a of amounts) total += a
  return money(total)
}

export function sum(amounts: readonly Money[]): Money {
  return add(...amounts)
}

/** Signed subtraction. May return a negative value — used for net win/loss. */
export function sub(a: Money, b: Money): Money {
  return money(a - b)
}

/**
 * Subtraction that refuses to go below zero.
 *
 * Use this for every ledger movement — taking from a stack, taking from the
 * bank. An overdraw is a bug, and it should be loud rather than silent.
 */
export function deduct(from: Money, amount: Money, what = 'balance'): Money {
  if (amount < 0) {
    throw new MoneyError(`Cannot deduct a negative amount (${amount}) from ${what}`)
  }
  if (amount > from) {
    throw new MoneyError(`Cannot deduct ${amount} from ${what} of ${from} — would overdraw`)
  }
  return money(from - amount)
}

export function mul(amount: Money, factor: number): Money {
  if (!Number.isInteger(factor)) {
    throw new MoneyError(`Multiplier must be a whole number, got ${factor}`)
  }
  return money(amount * factor)
}

/**
 * Split an amount N ways.
 *
 * Returns the whole part each winner gets plus whatever will not divide
 * evenly. The remainder is never dropped — the caller must hand it out (in
 * poker, one unit at a time clockwise from the dealer).
 */
export function split(amount: Money, ways: number): { each: Money; remainder: Money } {
  if (!Number.isInteger(ways) || ways < 1) {
    throw new MoneyError(`Cannot split ${ways} ways`)
  }
  const each = Math.floor(amount / ways)
  return { each: money(each), remainder: money(amount - each * ways) }
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export function min(a: Money, b: Money): Money {
  return a < b ? a : b
}

export function max(a: Money, b: Money): Money {
  return a > b ? a : b
}

export function isZero(a: Money): boolean {
  return a === 0
}

export function isPositive(a: Money): boolean {
  return a > 0
}

// ---------------------------------------------------------------------------
// Display
// ---------------------------------------------------------------------------

/**
 * Group digits in threes: 42300 -> "42,300".
 *
 * Written by hand rather than using Intl so the output is identical on every
 * device and in every test, regardless of the phone's locale settings.
 */
export function formatMoney(amount: Money): string {
  const negative = amount < 0
  const digits = Math.abs(amount).toString()

  let out = ''
  for (let i = 0; i < digits.length; i += 1) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ','
    out += digits.charAt(i)
  }

  return negative ? `-${out}` : out
}

/** Same as formatMoney but with an explicit sign, for net win/loss columns. */
export function formatSigned(amount: Money): string {
  if (amount > 0) return `+${formatMoney(amount)}`
  return formatMoney(amount)
}
