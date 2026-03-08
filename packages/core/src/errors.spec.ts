import { describe, it, expect } from 'vitest'
import { Stripe402Error } from './errors'

describe('Stripe402Error', () => {
  it('should create an error with code and message', () => {
    const err = new Stripe402Error('payment_required', 'Payment is required')
    expect(err.message).toBe('Payment is required')
    expect(err.code).toBe('payment_required')
    expect(err.name).toBe('Stripe402Error')
  })

  it('should be an instance of Error', () => {
    const err = new Stripe402Error('card_declined', 'Card was declined')
    expect(err).toBeInstanceOf(Error)
    expect(err).toBeInstanceOf(Stripe402Error)
  })

  it('should support all error codes', () => {
    const codes = [
      'payment_required',
      'card_declined',
      'insufficient_credits',
      'payment_failed',
      'invalid_payment',
      'top_up_below_minimum',
    ] as const

    for (const code of codes) {
      const err = new Stripe402Error(code, `Error: ${code}`)
      expect(err.code).toBe(code)
    }
  })

  it('should have a stack trace', () => {
    const err = new Stripe402Error('payment_failed', 'fail')
    expect(err.stack).toBeDefined()
    expect(err.stack).toContain('Stripe402Error')
  })

  it('should have readonly code property', () => {
    const err = new Stripe402Error('payment_required', 'test')
    // TypeScript enforces readonly, but verify the value persists
    expect(err.code).toBe('payment_required')
  })
})
