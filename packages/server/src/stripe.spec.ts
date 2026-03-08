import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockPaymentIntents = { create: vi.fn() }
const mockPaymentMethods = { retrieve: vi.fn() }
const mockCustomers = { search: vi.fn(), create: vi.fn() }

vi.mock('stripe', () => {
  return {
    default: class MockStripe {
      paymentIntents = mockPaymentIntents
      paymentMethods = mockPaymentMethods
      customers = mockCustomers
      constructor(public secretKey: string) {}
    },
  }
})

import { StripeService } from './stripe'

describe('StripeService', () => {
  let service: StripeService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new StripeService('sk_test_123')
  })

  describe('createAndConfirmPayment', () => {
    it('should create and confirm a PaymentIntent', async () => {
      const mockPI = { id: 'pi_123', status: 'succeeded' }
      mockPaymentIntents.create.mockResolvedValue(mockPI)

      const result = await service.createAndConfirmPayment({
        amount: 500,
        currency: 'usd',
        paymentMethodId: 'pm_123',
        customerId: 'cus_abc',
        description: 'Test payment',
      })

      expect(result).toEqual(mockPI)
      expect(mockPaymentIntents.create).toHaveBeenCalledWith({
        amount: 500,
        currency: 'usd',
        payment_method: 'pm_123',
        customer: 'cus_abc',
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
        description: 'Test payment',
      })
    })

    it('should work without optional params', async () => {
      const mockPI = { id: 'pi_456', status: 'succeeded' }
      mockPaymentIntents.create.mockResolvedValue(mockPI)

      await service.createAndConfirmPayment({
        amount: 1000,
        currency: 'eur',
        paymentMethodId: 'pm_789',
      })

      expect(mockPaymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 1000,
          currency: 'eur',
          customer: undefined,
          description: undefined,
        })
      )
    })
  })

  describe('getCardFingerprint', () => {
    it('should return the card fingerprint', async () => {
      mockPaymentMethods.retrieve.mockResolvedValue({
        id: 'pm_123',
        card: { fingerprint: 'fp_abc123', brand: 'visa' },
      })

      const fingerprint = await service.getCardFingerprint('pm_123')
      expect(fingerprint).toBe('fp_abc123')
      expect(mockPaymentMethods.retrieve).toHaveBeenCalledWith('pm_123')
    })

    it('should throw if PaymentMethod has no card', async () => {
      mockPaymentMethods.retrieve.mockResolvedValue({
        id: 'pm_123',
        card: null,
      })

      await expect(service.getCardFingerprint('pm_123')).rejects.toThrow(
        'does not have a card fingerprint'
      )
    })

    it('should throw if card has no fingerprint', async () => {
      mockPaymentMethods.retrieve.mockResolvedValue({
        id: 'pm_123',
        card: { fingerprint: null, brand: 'visa' },
      })

      await expect(service.getCardFingerprint('pm_123')).rejects.toThrow(
        'does not have a card fingerprint'
      )
    })
  })

  describe('findOrCreateCustomer', () => {
    it('should return existing customer if found by metadata search', async () => {
      const existingCustomer = { id: 'cus_existing', metadata: { stripe402_client_id: 'client123' } }
      mockCustomers.search.mockResolvedValue({
        data: [existingCustomer],
      })

      const result = await service.findOrCreateCustomer('client123', 'pm_123')
      expect(result).toEqual(existingCustomer)
      expect(mockCustomers.create).not.toHaveBeenCalled()
    })

    it('should create new customer when none found', async () => {
      mockCustomers.search.mockResolvedValue({ data: [] })
      const newCustomer = { id: 'cus_new', metadata: { stripe402_client_id: 'client123' } }
      mockCustomers.create.mockResolvedValue(newCustomer)

      const result = await service.findOrCreateCustomer('client123', 'pm_456')
      expect(result).toEqual(newCustomer)
      expect(mockCustomers.create).toHaveBeenCalledWith({
        payment_method: 'pm_456',
        metadata: { stripe402_client_id: 'client123' },
      })
    })

    it('should search with the correct metadata query', async () => {
      mockCustomers.search.mockResolvedValue({ data: [] })
      mockCustomers.create.mockResolvedValue({ id: 'cus_new' })

      await service.findOrCreateCustomer('my-client-id', 'pm_789')

      expect(mockCustomers.search).toHaveBeenCalledWith({
        query: 'metadata["stripe402_client_id"]:"my-client-id"',
      })
    })
  })
})
