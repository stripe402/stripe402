import { describe, it, expect } from 'vitest'
import {
  STRIPE402_VERSION,
  HEADERS,
  DEFAULT_MIN_TOP_UP,
  DEFAULT_CURRENCY,
  UNITS_PER_DOLLAR,
  UNITS_PER_CENT,
  unitsToCents,
  unitsToDollars,
} from './constants'

describe('constants', () => {
  it('should have version 1', () => {
    expect(STRIPE402_VERSION).toBe(1)
  })

  it('should have lowercase header names for HTTP compatibility', () => {
    expect(HEADERS.PAYMENT_REQUIRED).toBe('payment-required')
    expect(HEADERS.PAYMENT).toBe('payment')
    expect(HEADERS.PAYMENT_RESPONSE).toBe('payment-response')
  })

  it('should have a default min top-up of $5.00 (50000 units)', () => {
    expect(DEFAULT_MIN_TOP_UP).toBe(50_000)
  })

  it('should default to USD', () => {
    expect(DEFAULT_CURRENCY).toBe('usd')
  })

  it('should define 10000 units per dollar', () => {
    expect(UNITS_PER_DOLLAR).toBe(10_000)
  })

  it('should define 100 units per cent', () => {
    expect(UNITS_PER_CENT).toBe(100)
  })

  describe('unitsToCents', () => {
    it('should convert exact cent values', () => {
      expect(unitsToCents(100)).toBe(1)
      expect(unitsToCents(500)).toBe(5)
      expect(unitsToCents(50_000)).toBe(500)
    })

    it('should round up fractional cents', () => {
      expect(unitsToCents(50)).toBe(1) // 0.5 cents -> 1 cent
      expect(unitsToCents(150)).toBe(2) // 1.5 cents -> 2 cents
      expect(unitsToCents(1)).toBe(1) // 0.01 cents -> 1 cent
    })

    it('should handle zero', () => {
      expect(unitsToCents(0)).toBe(0)
    })
  })

  describe('unitsToDollars', () => {
    it('should format whole dollar amounts', () => {
      expect(unitsToDollars(10_000)).toBe('1')
      expect(unitsToDollars(50_000)).toBe('5')
    })

    it('should format cent amounts', () => {
      expect(unitsToDollars(100)).toBe('0.01')
      expect(unitsToDollars(500)).toBe('0.05')
    })

    it('should format sub-cent amounts', () => {
      expect(unitsToDollars(50)).toBe('0.005')
      expect(unitsToDollars(1)).toBe('0.0001')
    })

    it('should handle zero', () => {
      expect(unitsToDollars(0)).toBe('0')
    })
  })
})
