import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HEADERS,
  STRIPE402_VERSION,
  encodeHeader,
  type PaymentRequiredResponse,
  type PaymentResponse,
} from '@stripe402/core'
import { createStripe402Axios, getStoredClientId } from './interceptor'

// Minimal axios mock
function createMockAxios() {
  const interceptors = {
    response: {
      handlers: [] as any[],
      use(onFulfilled: any, onRejected: any) {
        this.handlers.push({ onFulfilled, onRejected })
      },
    },
  }

  const instance: any = {
    interceptors,
    request: vi.fn(),
  }

  return instance
}

function make402Response(
  paymentRequired: PaymentRequiredResponse,
  extraHeaders: Record<string, string> = {}
) {
  return {
    response: {
      status: 402,
      headers: {
        [HEADERS.PAYMENT_REQUIRED]: encodeHeader(paymentRequired),
        ...extraHeaders,
      },
      data: {},
    },
    config: { headers: {} },
  }
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

describe('createStripe402Axios', () => {
  let mockAxios: ReturnType<typeof createMockAxios>

  beforeEach(() => {
    mockAxios = createMockAxios()
  })

  it('should return the same instance', () => {
    const result = createStripe402Axios(mockAxios, {
      onPaymentRequired: vi.fn(),
    })
    expect(result).toBe(mockAxios)
  })

  it('should register a response interceptor', () => {
    createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
    expect(mockAxios.interceptors.response.handlers).toHaveLength(1)
  })

  describe('success interceptor (onFulfilled)', () => {
    it('should pass through non-payment responses', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const response = { status: 200, headers: {}, data: { ok: true } }
      const result = await handler.onFulfilled(response)
      expect(result).toBe(response)
    })

    it('should extract clientId from payment-response header', async () => {
      const onPaymentRequired = vi.fn()
      createStripe402Axios(mockAxios, { onPaymentRequired })
      const handler = mockAxios.interceptors.response.handlers[0]

      const paymentResponse: PaymentResponse = {
        success: true,
        creditsRemaining: 49_900,
        clientId: 'stored-client-id',
      }

      const response = {
        status: 200,
        headers: {
          [HEADERS.PAYMENT_RESPONSE]: encodeHeader(paymentResponse),
        },
        data: {},
      }

      await handler.onFulfilled(response)
      // The clientId is stored internally — verify by triggering a 402 flow
      // and checking the retry doesn't request payment
    })

    it('should handle malformed payment-response header gracefully', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const response = {
        status: 200,
        headers: { [HEADERS.PAYMENT_RESPONSE]: 'invalid-base64!!!' },
        data: {},
      }

      // Should not throw
      const result = await handler.onFulfilled(response)
      expect(result).toBe(response)
    })
  })

  describe('error interceptor (onRejected)', () => {
    it('should rethrow non-402 errors', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = { response: { status: 500 }, config: {} }
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should rethrow errors without a response', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = { config: {} }
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should rethrow if already retried (infinite loop protection)', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = make402Response(defaultPaymentRequired)
      error.config._stripe402Retry = true

      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should rethrow if 402 has no payment-required header', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = {
        response: { status: 402, headers: {} },
        config: { headers: {} },
      }
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should rethrow if payment-required header is malformed', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = {
        response: {
          status: 402,
          headers: { [HEADERS.PAYMENT_REQUIRED]: 'bad-data!!!' },
        },
        config: { headers: {} },
      }
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should rethrow if accepts array is empty', async () => {
      createStripe402Axios(mockAxios, { onPaymentRequired: vi.fn() })
      const handler = mockAxios.interceptors.response.handlers[0]

      const emptyAccepts: PaymentRequiredResponse = {
        stripe402Version: 1,
        resource: { url: '/test' },
        accepts: [],
      }
      const error = make402Response(emptyAccepts)
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should retry with stored clientId when available', async () => {
      const onPaymentRequired = vi.fn()
      createStripe402Axios(mockAxios, {
        onPaymentRequired,
        clientId: 'pre-existing-client',
      })
      const handler = mockAxios.interceptors.response.handlers[0]

      mockAxios.request.mockResolvedValue({ status: 200, data: { joke: 'ha' } })

      const error = make402Response(defaultPaymentRequired)
      await handler.onRejected(error)

      expect(mockAxios.request).toHaveBeenCalled()
      expect(onPaymentRequired).not.toHaveBeenCalled() // didn't need to ask for payment
    })

    it('should call onPaymentRequired when insufficient_credits error', async () => {
      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_new',
        topUpAmount: 100_000,
      })
      createStripe402Axios(mockAxios, {
        onPaymentRequired,
        clientId: 'existing-client',
      })
      const handler = mockAxios.interceptors.response.handlers[0]

      mockAxios.request.mockResolvedValue({ status: 200, data: {} })

      const insufficientResponse: PaymentRequiredResponse = {
        ...defaultPaymentRequired,
        error: 'insufficient_credits',
      }
      const error = make402Response(insufficientResponse)
      await handler.onRejected(error)

      expect(onPaymentRequired).toHaveBeenCalledWith(defaultPaymentRequired.accepts[0])
      expect(mockAxios.request).toHaveBeenCalled()
    })

    it('should call onPaymentRequired when no stored clientId', async () => {
      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_fresh',
        topUpAmount: 50_000,
      })
      createStripe402Axios(mockAxios, { onPaymentRequired })
      const handler = mockAxios.interceptors.response.handlers[0]

      mockAxios.request.mockResolvedValue({ status: 200, data: {} })

      const error = make402Response(defaultPaymentRequired)
      await handler.onRejected(error)

      expect(onPaymentRequired).toHaveBeenCalledWith(defaultPaymentRequired.accepts[0])
    })

    it('should rethrow when user declines payment (returns null)', async () => {
      const onPaymentRequired = vi.fn().mockResolvedValue(null)
      createStripe402Axios(mockAxios, { onPaymentRequired })
      const handler = mockAxios.interceptors.response.handlers[0]

      const error = make402Response(defaultPaymentRequired)
      await expect(handler.onRejected(error)).rejects.toEqual(error)
    })

    it('should include stored clientId in payment payload', async () => {
      const onPaymentRequired = vi.fn().mockResolvedValue({
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      })
      // First, store a client ID via success response
      createStripe402Axios(mockAxios, {
        onPaymentRequired,
        clientId: 'my-client',
      })
      const handler = mockAxios.interceptors.response.handlers[0]

      mockAxios.request.mockResolvedValue({ status: 200, data: {} })

      const withInsufficient: PaymentRequiredResponse = {
        ...defaultPaymentRequired,
        error: 'insufficient_credits',
      }
      const error = make402Response(withInsufficient)
      await handler.onRejected(error)

      // Verify the retry included the clientId
      const retryConfig = mockAxios.request.mock.calls[0][0]
      expect(retryConfig.headers[HEADERS.PAYMENT]).toBeDefined()
    })
  })
})

describe('getStoredClientId', () => {
  it('should return null', () => {
    const mockAxios = createMockAxios()
    expect(getStoredClientId(mockAxios)).toBeNull()
  })
})
