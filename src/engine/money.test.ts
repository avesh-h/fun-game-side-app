import { describe, expect, it } from 'vitest'
import {
  add,
  deduct,
  formatMoney,
  formatSigned,
  money,
  MoneyError,
  mul,
  parseMoney,
  split,
  sub,
  sum,
  ZERO,
} from './money'

describe('money()', () => {
  it('accepts whole numbers', () => {
    expect(money(0)).toBe(0)
    expect(money(20)).toBe(20)
    expect(money(-50)).toBe(-50)
  })

  it('rejects anything with a decimal part', () => {
    // This is the guard the whole ledger rests on.
    expect(() => money(0.5)).toThrow(MoneyError)
    expect(() => money(99.99)).toThrow(MoneyError)
    expect(() => money(0.1 + 0.2)).toThrow(MoneyError)
  })

  it('rejects NaN and Infinity', () => {
    expect(() => money(NaN)).toThrow(MoneyError)
    expect(() => money(Infinity)).toThrow(MoneyError)
    expect(() => money(-Infinity)).toThrow(MoneyError)
  })

  it('rejects values past the safe integer range', () => {
    expect(() => money(Number.MAX_SAFE_INTEGER + 2)).toThrow(MoneyError)
  })
})

describe('addition', () => {
  it('adds', () => {
    expect(add(money(10), money(20), money(5))).toBe(35)
  })

  it('sums a list, including an empty one', () => {
    expect(sum([money(100), money(250)])).toBe(350)
    expect(sum([])).toBe(ZERO)
  })
})

describe('subtraction', () => {
  it('sub allows a negative result, for net win/loss', () => {
    expect(sub(money(300), money(1000))).toBe(-700)
  })

  it('deduct refuses to overdraw', () => {
    expect(deduct(money(1000), money(400))).toBe(600)
    expect(() => deduct(money(300), money(400), 'stack')).toThrow(MoneyError)
  })

  it('deduct refuses a negative amount', () => {
    expect(() => deduct(money(1000), money(-50))).toThrow(MoneyError)
  })

  it('deduct to exactly zero is fine — that is a player going all-in', () => {
    expect(deduct(money(750), money(750))).toBe(0)
  })
})

describe('mul', () => {
  it('multiplies by a whole factor', () => {
    expect(mul(money(20), 5)).toBe(100)
  })

  it('refuses a fractional factor, which would create fractional money', () => {
    expect(() => mul(money(100), 0.5)).toThrow(MoneyError)
  })
})

describe('split', () => {
  it('splits evenly', () => {
    expect(split(money(900), 3)).toEqual({ each: 300, remainder: 0 })
  })

  it('never loses the odd chip', () => {
    const { each, remainder } = split(money(175), 2)
    expect(each).toBe(87)
    expect(remainder).toBe(1)
    // The pot must come out exactly whole again.
    expect(each * 2 + remainder).toBe(175)
  })

  it('handles a remainder larger than one', () => {
    const { each, remainder } = split(money(100), 3)
    expect(each).toBe(33)
    expect(remainder).toBe(1)
    expect(each * 3 + remainder).toBe(100)
  })

  it('splitting three ways with two left over still balances', () => {
    const { each, remainder } = split(money(11), 3)
    expect(each).toBe(3)
    expect(remainder).toBe(2)
    expect(each * 3 + remainder).toBe(11)
  })

  it('refuses a nonsense number of ways', () => {
    expect(() => split(money(100), 0)).toThrow(MoneyError)
    expect(() => split(money(100), -1)).toThrow(MoneyError)
  })
})

describe('formatting', () => {
  it('groups digits in threes', () => {
    expect(formatMoney(money(0))).toBe('0')
    expect(formatMoney(money(50))).toBe('50')
    expect(formatMoney(money(999))).toBe('999')
    expect(formatMoney(money(1000))).toBe('1,000')
    expect(formatMoney(money(42300))).toBe('42,300')
    expect(formatMoney(money(1234567))).toBe('1,234,567')
  })

  it('handles negatives', () => {
    expect(formatMoney(money(-1500))).toBe('-1,500')
  })

  it('adds an explicit plus for amounts that are up', () => {
    expect(formatSigned(money(2400))).toBe('+2,400')
    expect(formatSigned(money(-800))).toBe('-800')
    expect(formatSigned(ZERO)).toBe('0')
  })
})

describe('parseMoney', () => {
  it('reads plain digits', () => {
    expect(parseMoney('500')).toBe(500)
  })

  it('tolerates the separators people actually type', () => {
    expect(parseMoney('42,300')).toBe(42300)
    expect(parseMoney(' 1 000 ')).toBe(1000)
  })

  it('rejects decimals, letters and empty input', () => {
    expect(parseMoney('10.5')).toBeNull()
    expect(parseMoney('abc')).toBeNull()
    expect(parseMoney('')).toBeNull()
    expect(parseMoney('   ')).toBeNull()
  })
})
