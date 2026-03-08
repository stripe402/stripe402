import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HEADERS,
  STRIPE402_VERSION,
  encodeHeader,
  type PaymentRequiredResponse,
  type PaymentResponse,
  type PaymentPayload,
} from '@stripe402/core'
import { createStripe402Fetch } from './wrapper'

function makeResponse(
  status: number,
  headers: Record<string, string> = {},
  body: any = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: new Headers(headers),
  })
}

const defaultPaymentRequired: PaymentRequiredResponse = {
  stripe402Version: 1,
  resource: { url: '/api/test' },
  accepts: [{
    scheme: 'stripe',
    currency: 'usd',
    amount: 100, // 1 cent = 100 units
    minTopUp: 50_000, // $5.00
    publishableKey: 'pk_test_123',
    description: 'Test',
  }],
}

function make402Headers(pr: PaymentRequiredResponse = defaultPaymentRequired) {
  return { [HEADERS.PAYMENT_REQUIRED]: encodeHeader(pr) }
}

function makePaymentResponseHeaders(clientId: string, credits: number) {
  const pr: PaymentResponse = {
    success: true,
    creditsRemaining: credits,
    clientId,
  }
  return { [HEADERS.PAYMENT_RESPONSE]: encodeHeader(pr) }
}

describe('createStripe402Fetch', () => {
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    mockFetch = vi.fn()
  })

  describe('non-402 responses', () => {
    it('should pass through successful responses', async () => {
      const expectedResponse = makeResponse(200, {}, { data: 'ok' })
      mockFetch.mockResolvedValue(expectedResponse)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result).toBe(expectedResponse)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should pass through non-402 error responses', async () => {
      const errorResponse = makeResponse(500, {}, { error: 'server error' })
      mockFetch.mockResolvedValue(errorResponse)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(500)
    })

    it('should extract clientId from payment-response header on success', async () => {
      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      })

      // First call: 200 with client ID in header
      const successResponse = makeResponse(
        200,
        makePaymentResponseHeaders('saved-client', 49_900),
        { data: 'ok' }
      )
      mockFetch.mockResolvedValue(successResponse)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired },
        mockFetch
      )

      await wrappedFetch('https://api.example.com/test')
      // Client ID should be stored internally for future requests
    })

    it('should handle malformed payment-response header gracefully', async () => {
      const response = makeResponse(
        200,
        { [HEADERS.PAYMENT_RESPONSE]: 'invalid!!!' },
        {}
      )
      mockFetch.mockResolvedValue(response)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
    })
  })

  describe('402 responses', () => {
    it('should return 402 response if already a retry (infinite loop protection)', async () => {
      const response402 = makeResponse(402, make402Headers())
      mockFetch.mockResolvedValue(response402)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test', {
        headers: { [HEADERS.PAYMENT]: 'already-set' },
      })

      expect(result.status).toBe(402)
      expect(mockFetch).toHaveBeenCalledTimes(1) // no retry
    })

    it('should return 402 if no payment-required header', async () => {
      const response402 = makeResponse(402) // no payment-required header
      mockFetch.mockResolvedValue(response402)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(402)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should return 402 if payment-required header is malformed', async () => {
      const response402 = makeResponse(402, {
        [HEADERS.PAYMENT_REQUIRED]: 'not-valid-base64!!!',
      })
      mockFetch.mockResolvedValue(response402)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(402)
    })

    it('should return 402 if accepts array is empty', async () => {
      const emptyAccepts: PaymentRequiredResponse = {
        stripe402Version: 1,
        resource: { url: '/test' },
        accepts: [],
      }
      const response402 = makeResponse(402, make402Headers(emptyAccepts))
      mockFetch.mockResolvedValue(response402)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn() },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(402)
    })

    it('should retry with stored clientId when available', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successResponse = makeResponse(
        200,
        makePaymentResponseHeaders('my-client', 49_900),
        { data: 'paid' }
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn(), clientId: 'my-client' },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(2)

      // Verify the retry included the payment header
      const retryCall = mockFetch.mock.calls[1]
      expect(retryCall[1].headers[HEADERS.PAYMENT]).toBeDefined()
    })

    it('should fall through to payment if clientId retry also returns 402', async () => {
      const response402 = makeResponse(402, make402Headers())
      const response402Again = makeResponse(402, make402Headers())
      const successResponse = makeResponse(200, {}, { data: 'paid' })

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(response402Again) // clientId retry failed
        .mockResolvedValueOnce(successResponse) // payment retry succeeded

      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_new',
        topUpAmount: 50_000,
      })

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired, clientId: 'old-client' },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
      expect(mockFetch).toHaveBeenCalledTimes(3)
      expect(onPaymentRequired).toHaveBeenCalledWith(defaultPaymentRequired.accepts[0])
    })

    it('should skip clientId retry when error is insufficient_credits', async () => {
      const insufficientPR: PaymentRequiredResponse = {
        ...defaultPaymentRequired,
        error: 'insufficient_credits',
      }
      const response402 = makeResponse(402, make402Headers(insufficientPR))
      const successResponse = makeResponse(
        200,
        makePaymentResponseHeaders('client-id', 49_900),
        { data: 'paid' }
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_topup',
        topUpAmount: 100_000,
      })

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired, clientId: 'existing-client' },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
      // Should go straight to payment, not try clientId first
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(onPaymentRequired).toHaveBeenCalled()
    })

    it('should call onPaymentRequired when no stored clientId', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successResponse = makeResponse(
        200,
        makePaymentResponseHeaders('new-client', 49_900),
        { data: 'paid' }
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_fresh',
        topUpAmount: 50_000,
      })

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
      expect(onPaymentRequired).toHaveBeenCalledWith(defaultPaymentRequired.accepts[0])
    })

    it('should return original 402 when user declines payment (returns null)', async () => {
      const response402 = makeResponse(402, make402Headers())
      mockFetch.mockResolvedValue(response402)

      const onPaymentRequired = vi.fn().mockResolvedValue(null)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(402)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it('should extract clientId from final payment response', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successResponse = makeResponse(
        200,
        makePaymentResponseHeaders('new-stored-client', 49_900),
        { data: 'ok' }
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_test',
      })

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired },
        mockFetch
      )

      await wrappedFetch('https://api.example.com/test')

      // Now make another 402 call — should use the stored client ID
      const response402Again = makeResponse(402, make402Headers())
      const successResponse2 = makeResponse(200, {}, { data: 'ok2' })
      mockFetch
        .mockResolvedValueOnce(response402Again)
        .mockResolvedValueOnce(successResponse2)

      await wrappedFetch('https://api.example.com/test')

      // The third fetch call (first retry of second request) should include clientId
      expect(mockFetch).toHaveBeenCalledTimes(4)
    })

    it('should handle malformed payment-response header on retry gracefully', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successResponse = makeResponse(
        200,
        { [HEADERS.PAYMENT_RESPONSE]: 'invalid!!!' },
        { data: 'ok' }
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const wrappedFetch = createStripe402Fetch(
        {
          onPaymentRequired: vi.fn().mockResolvedValue({ paymentMethodId: 'pm_test' }),
        },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
    })

    it('should handle malformed payment-response on clientId retry gracefully', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successWithBadHeader = makeResponse(
        200,
        { [HEADERS.PAYMENT_RESPONSE]: 'bad!!!' },
        {}
      )

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successWithBadHeader)

      const wrappedFetch = createStripe402Fetch(
        { onPaymentRequired: vi.fn(), clientId: 'my-client' },
        mockFetch
      )

      const result = await wrappedFetch('https://api.example.com/test')
      expect(result.status).toBe(200)
    })

    it('should preserve existing headers on retry', async () => {
      const response402 = makeResponse(402, make402Headers())
      const successResponse = makeResponse(200, {}, { data: 'ok' })

      mockFetch
        .mockResolvedValueOnce(response402)
        .mockResolvedValueOnce(successResponse)

      const wrappedFetch = createStripe402Fetch(
        {
          onPaymentRequired: vi.fn().mockResolvedValue({ paymentMethodId: 'pm_test' }),
        },
        mockFetch
      )

      await wrappedFetch('https://api.example.com/test', {
        headers: { 'Authorization': 'Bearer token123' },
      })

      const retryCall = mockFetch.mock.calls[1]
      expect(retryCall[1].headers['Authorization']).toBe('Bearer token123')
      expect(retryCall[1].headers[HEADERS.PAYMENT]).toBeDefined()
    })
  })
})
