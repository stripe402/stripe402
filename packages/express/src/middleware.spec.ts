import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  HEADERS,
  STRIPE402_VERSION,
  encodeHeader,
  decodeHeader,
  type PaymentPayload,
  type PaymentRequiredResponse,
  type PaymentResponse,
  type Stripe402Store,
  type Stripe402ServerConfig,
} from '@stripe402/core'
import { stripe402Middleware } from './middleware'

const mockGetCardFingerprint = vi.fn()
const mockFindOrCreateCustomer = vi.fn()
const mockCreateAndConfirmPayment = vi.fn()

vi.mock('@stripe402/server', () => ({
  StripeService: class MockStripeService {
    getCardFingerprint = mockGetCardFingerprint
    findOrCreateCustomer = mockFindOrCreateCustomer
    createAndConfirmPayment = mockCreateAndConfirmPayment
    constructor(_secretKey: string) {}
  },
}))

function createMockStore(): Stripe402Store & { recordTransaction: ReturnType<typeof vi.fn> } {
  return {
    getClient: vi.fn(),
    createClient: vi.fn(),
    deductBalance: vi.fn(),
    addBalance: vi.fn(),
    recordTransaction: vi.fn(),
  }
}

function createMockReq(method: string, path: string, headers: Record<string, string> = {}) {
  return {
    method,
    path,
    headers,
  } as any
}

function createMockRes() {
  const res: any = {
    _status: 0,
    _headers: {} as Record<string, string>,
    _json: null as any,
    status(code: number) {
      res._status = code
      return res
    },
    set(name: string, value: string) {
      res._headers[name] = value
      return res
    },
    json(body: any) {
      res._json = body
      return res
    },
  }
  return res
}

describe('stripe402Middleware', () => {
  let store: ReturnType<typeof createMockStore>
  let config: Stripe402ServerConfig
  let middleware: ReturnType<typeof stripe402Middleware>
  beforeEach(() => {
    vi.clearAllMocks()
    store = createMockStore()
    config = {
      stripeSecretKey: 'sk_test_123',
      stripePublishableKey: 'pk_test_123',
      serverSecret: 'server-secret',
      store,
      routes: {
        'GET /api/joke': { amount: 100, description: 'Random joke' }, // 1 cent = 100 units
        'GET /api/weather': { amount: 500, currency: 'eur', minTopUp: 100_000, description: 'Weather' }, // 5 cents, $10 min
      },
    }
    middleware = stripe402Middleware(config)
  })

  describe('non-paid routes', () => {
    it('should call next() for routes not in config', async () => {
      const req = createMockReq('GET', '/api/health')
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(res._status).toBe(0) // status was never set
    })
  })

  describe('402 Payment Required', () => {
    it('should return 402 when no payment header is present', async () => {
      const req = createMockReq('GET', '/api/joke')
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(next).not.toHaveBeenCalled()
      expect(res._headers[HEADERS.PAYMENT_REQUIRED]).toBeDefined()

      const body = res._json as PaymentRequiredResponse
      expect(body.stripe402Version).toBe(STRIPE402_VERSION)
      expect(body.resource.url).toBe('/api/joke')
      expect(body.accepts[0].scheme).toBe('stripe')
      expect(body.accepts[0].amount).toBe(100)
      expect(body.accepts[0].publishableKey).toBe('pk_test_123')
      expect(body.accepts[0].description).toBe('Random joke')
    })

    it('should use default currency and minTopUp when not specified in route config', async () => {
      const req = createMockReq('GET', '/api/joke')
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      const body = res._json as PaymentRequiredResponse
      expect(body.accepts[0].currency).toBe('usd')
      expect(body.accepts[0].minTopUp).toBe(50_000) // default $5.00
    })

    it('should use custom currency and minTopUp from route config', async () => {
      const req = createMockReq('GET', '/api/weather')
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      const body = res._json as PaymentRequiredResponse
      expect(body.accepts[0].currency).toBe('eur')
      expect(body.accepts[0].minTopUp).toBe(100_000)
    })

    it('should encode the PaymentRequiredResponse in the header', async () => {
      const req = createMockReq('GET', '/api/joke')
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      const headerValue = res._headers[HEADERS.PAYMENT_REQUIRED]
      const decoded = decodeHeader<PaymentRequiredResponse>(headerValue)
      expect(decoded.stripe402Version).toBe(STRIPE402_VERSION)
      expect(decoded.accepts[0].amount).toBe(100)
    })
  })

  describe('malformed payment header', () => {
    it('should return error for invalid base64 in payment header', async () => {
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: 'not-valid-base64!!!',
      })
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.errorCode).toBe('invalid_payment')
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('balance deduction (existing clientId)', () => {
    it('should deduct balance and serve resource when credits are sufficient', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        clientId: 'client123',
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      store.deductBalance.mockResolvedValue(49_900)

      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(store.deductBalance).toHaveBeenCalledWith('client123', 100)

      // Check payment response header
      const responseHeader = res._headers[HEADERS.PAYMENT_RESPONSE]
      expect(responseHeader).toBeDefined()
      const paymentResponse = decodeHeader<PaymentResponse>(responseHeader)
      expect(paymentResponse.success).toBe(true)
      expect(paymentResponse.creditsRemaining).toBe(49_900)
      expect(paymentResponse.clientId).toBe('client123')
    })

    it('should record a deduction transaction', async () => {
      const payload: PaymentPayload = { stripe402Version: 1, clientId: 'client123' }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      store.deductBalance.mockResolvedValue(49_900)

      await middleware(req, res, next)

      expect(store.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: 'client123',
          type: 'deduction',
          amount: 100,
          resource: 'GET /api/joke',
        })
      )
    })

    it('should return 402 with insufficient_credits when balance is too low', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        clientId: 'client123',
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      store.deductBalance.mockResolvedValue(null) // insufficient

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.error).toBe('insufficient_credits')
      expect(next).not.toHaveBeenCalled()
    })
  })

  describe('new payment flow', () => {
    it('should return 402 when no paymentMethodId and no clientId', async () => {
      const payload: PaymentPayload = { stripe402Version: 1 }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(next).not.toHaveBeenCalled()
    })

    it('should reject top-up below minimum', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_123',
        topUpAmount: 10_000, // $1 = below default $5 minimum
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.errorCode).toBe('top_up_below_minimum')
    })

    it('should process payment, create client, credit balance, deduct, and serve resource', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000, // $5.00
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_card123')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_new' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_success',
        status: 'succeeded',
      })
      store.getClient.mockResolvedValue(null) // new client
      store.addBalance.mockResolvedValue(50_000)
      store.deductBalance
        .mockResolvedValueOnce(null) // first call: no existing balance, skip early deduct
        .mockResolvedValueOnce(49_900) // second call: after top-up, deduct succeeds

      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()

      // Verify Stripe calls — amount should be converted to cents
      expect(mockGetCardFingerprint).toHaveBeenCalledWith('pm_test')
      expect(mockFindOrCreateCustomer).toHaveBeenCalled()
      expect(mockCreateAndConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500, currency: 'usd' }) // 50000 units = 500 cents
      )

      // Verify store operations
      expect(store.createClient).toHaveBeenCalled()
      expect(store.addBalance).toHaveBeenCalled()
      expect(store.deductBalance).toHaveBeenCalled()

      // Verify payment response header
      const responseHeader = res._headers[HEADERS.PAYMENT_RESPONSE]
      const paymentResponse = decodeHeader<PaymentResponse>(responseHeader)
      expect(paymentResponse.success).toBe(true)
      expect(paymentResponse.chargeId).toBe('pi_success')
      expect(paymentResponse.creditsRemaining).toBe(49_900)
    })

    it('should not create client if one already exists', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_existing')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_existing' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_success',
        status: 'succeeded',
      })
      store.getClient.mockResolvedValue({ clientId: 'existing' }) // already exists
      store.addBalance.mockResolvedValue(100_000)
      store.deductBalance
        .mockResolvedValueOnce(null) // first call: no existing balance (or insufficient)
        .mockResolvedValueOnce(99_900) // second call: after top-up

      await middleware(req, res, next)

      expect(store.createClient).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalled()
    })

    it('should use default minTopUp when topUpAmount is not provided', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        // no topUpAmount — defaults to minTopUp
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_card')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_test' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_default',
        status: 'succeeded',
      })
      store.getClient.mockResolvedValue(null)
      store.addBalance.mockResolvedValue(50_000)
      store.deductBalance
        .mockResolvedValueOnce(null) // first call: no existing balance
        .mockResolvedValueOnce(49_900) // second call: after top-up

      await middleware(req, res, next)

      expect(mockCreateAndConfirmPayment).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 500 }) // 50000 units -> 500 cents
      )
    })

    it('should return error when payment does not succeed', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_card')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_test' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_pending',
        status: 'requires_action', // 3D Secure, etc.
      })
      store.deductBalance.mockResolvedValueOnce(null) // no existing balance

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.errorCode).toBe('payment_failed')
      expect(res._json.error).toContain('requires_action')
      expect(next).not.toHaveBeenCalled()
    })

    it('should handle StripeCardError (card declined)', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockRejectedValue({
        type: 'StripeCardError',
        message: 'Your card was declined',
      })

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.errorCode).toBe('card_declined')
      expect(res._json.error).toBe('Your card was declined')
    })

    it('should handle generic Stripe errors', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockRejectedValue(
        new Error('Network error')
      )

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.errorCode).toBe('payment_failed')
      expect(res._json.error).toBe('Network error')
    })

    it('should handle errors without a message', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockRejectedValue({})

      await middleware(req, res, next)

      expect(res._status).toBe(402)
      expect(res._json.error).toBe('Payment processing failed')
    })

    it('should record both topup and deduction transactions', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_card')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_test' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_ok',
        status: 'succeeded',
      })
      store.getClient.mockResolvedValue(null)
      store.addBalance.mockResolvedValue(50_000)
      store.deductBalance
        .mockResolvedValueOnce(null) // first call: no existing balance
        .mockResolvedValueOnce(49_900) // second call: after top-up

      await middleware(req, res, next)

      // Should have recorded 2 transactions: topup + deduction
      expect(store.recordTransaction).toHaveBeenCalledTimes(2)
      expect(store.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'topup', amount: 50_000 })
      )
      expect(store.recordTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'deduction', amount: 100 })
      )
    })
  })

  describe('insufficient balance with paymentMethodId (top-up + retry)', () => {
    it('should process payment when clientId has insufficient balance but paymentMethodId is provided', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        clientId: 'client123',
        paymentMethodId: 'pm_topup',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      store.deductBalance
        .mockResolvedValueOnce(null) // first: clientId deduction fails (insufficient)
        .mockResolvedValueOnce(null) // second: early fingerprint-based check also fails
        .mockResolvedValueOnce(49_900) // third: deduction after top-up succeeds
      mockGetCardFingerprint.mockResolvedValue('fp_card')
      mockFindOrCreateCustomer.mockResolvedValue({ id: 'cus_test' })
      mockCreateAndConfirmPayment.mockResolvedValue({
        id: 'pi_topup',
        status: 'succeeded',
      })
      store.getClient.mockResolvedValue({ clientId: 'client123' })
      store.addBalance.mockResolvedValue(50_000)

      await middleware(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(mockCreateAndConfirmPayment).toHaveBeenCalled()
    })
  })

  describe('skip charge when existing balance is sufficient', () => {
    it('should deduct from existing balance without charging when paymentMethodId is sent but credits exist', async () => {
      const payload: PaymentPayload = {
        stripe402Version: 1,
        paymentMethodId: 'pm_test',
        topUpAmount: 50_000,
      }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      mockGetCardFingerprint.mockResolvedValue('fp_card_existing')
      // Early deduct succeeds — client already has credits
      store.deductBalance.mockResolvedValueOnce(49_900)

      await middleware(req, res, next)

      // Should serve the resource without charging
      expect(next).toHaveBeenCalled()
      expect(mockFindOrCreateCustomer).not.toHaveBeenCalled()
      expect(mockCreateAndConfirmPayment).not.toHaveBeenCalled()

      // Verify response
      const responseHeader = res._headers[HEADERS.PAYMENT_RESPONSE]
      const paymentResponse = decodeHeader<PaymentResponse>(responseHeader)
      expect(paymentResponse.success).toBe(true)
      expect(paymentResponse.creditsRemaining).toBe(49_900)
      expect(paymentResponse.chargeId).toBeUndefined()
    })
  })

  describe('store without recordTransaction', () => {
    it('should work when store does not implement recordTransaction', async () => {
      const storeWithoutTxn: Stripe402Store = {
        getClient: vi.fn().mockResolvedValue(null),
        createClient: vi.fn(),
        deductBalance: vi.fn().mockResolvedValue(49_900),
        addBalance: vi.fn().mockResolvedValue(50_000),
        // no recordTransaction
      }
      const configNoTxn = { ...config, store: storeWithoutTxn }
      const mw = stripe402Middleware(configNoTxn)

      // Test balance deduction path
      const payload: PaymentPayload = { stripe402Version: 1, clientId: 'client123' }
      const req = createMockReq('GET', '/api/joke', {
        [HEADERS.PAYMENT]: encodeHeader(payload),
      })
      const res = createMockRes()
      const next = vi.fn()

      await mw(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })
})
