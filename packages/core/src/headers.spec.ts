import { describe, it, expect } from 'vitest'
import { encodeHeader, decodeHeader } from './headers'

describe('headers', () => {
  describe('encodeHeader', () => {
    it('should encode a simple object to base64 JSON', () => {
      const data = { foo: 'bar', num: 42 }
      const encoded = encodeHeader(data)

      // Verify it's valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow()

      // Verify the base64 decodes to the original JSON
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
      expect(decoded).toEqual(data)
    })

    it('should encode nested objects', () => {
      const data = { resource: { url: '/api/test', description: 'Test' }, accepts: [{ scheme: 'stripe' }] }
      const encoded = encodeHeader(data)
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
      expect(decoded).toEqual(data)
    })

    it('should encode empty objects', () => {
      const encoded = encodeHeader({})
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
      expect(decoded).toEqual({})
    })

    it('should handle special characters in values', () => {
      const data = { msg: 'hello "world" with special chars: <>&' }
      const encoded = encodeHeader(data)
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
      expect(decoded).toEqual(data)
    })

    it('should handle unicode characters', () => {
      const data = { emoji: '💳', text: 'Ünïcödé' }
      const encoded = encodeHeader(data)
      const decoded = JSON.parse(Buffer.from(encoded, 'base64').toString('utf-8'))
      expect(decoded).toEqual(data)
    })
  })

  describe('decodeHeader', () => {
    it('should decode a base64 JSON string back to the original object', () => {
      const original = { foo: 'bar', num: 42 }
      const encoded = Buffer.from(JSON.stringify(original)).toString('base64')
      const decoded = decodeHeader<typeof original>(encoded)
      expect(decoded).toEqual(original)
    })

    it('should roundtrip with encodeHeader', () => {
      const data = { stripe402Version: 1, amount: 50_000, currency: 'usd' }
      const encoded = encodeHeader(data)
      const decoded = decodeHeader<typeof data>(encoded)
      expect(decoded).toEqual(data)
    })

    it('should throw on invalid base64', () => {
      expect(() => decodeHeader('not valid base64!!!')).toThrow()
    })

    it('should throw on base64 that is not valid JSON', () => {
      const notJson = Buffer.from('this is not json').toString('base64')
      expect(() => decodeHeader(notJson)).toThrow()
    })

    it('should decode arrays', () => {
      const data = [1, 2, 3]
      const encoded = encodeHeader(data)
      const decoded = decodeHeader<number[]>(encoded)
      expect(decoded).toEqual(data)
    })
  })

  describe('roundtrip with protocol types', () => {
    it('should roundtrip PaymentRequiredResponse', () => {
      const data = {
        stripe402Version: 1,
        resource: { url: '/api/weather', description: 'Weather data' },
        accepts: [{
          scheme: 'stripe' as const,
          currency: 'usd',
          amount: 500,
          minTopUp: 50_000,
          publishableKey: 'pk_test_123',
          description: 'Weather lookup',
        }],
      }
      const roundtripped = decodeHeader(encodeHeader(data))
      expect(roundtripped).toEqual(data)
    })

    it('should roundtrip PaymentPayload', () => {
      const data = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test_123',
        clientId: 'abc123',
        topUpAmount: 100_000,
      }
      const roundtripped = decodeHeader(encodeHeader(data))
      expect(roundtripped).toEqual(data)
    })

    it('should roundtrip PaymentResponse', () => {
      const data = {
        success: true,
        chargeId: 'pi_test_123',
        creditsRemaining: 49_900,
        clientId: 'abc123',
      }
      const roundtripped = decodeHeader(encodeHeader(data))
      expect(roundtripped).toEqual(data)
    })
  })
})
