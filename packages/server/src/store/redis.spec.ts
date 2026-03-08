import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RedisStore } from './redis'
import type { ClientRecord, TransactionRecord } from '@stripe402/core'

function createMockRedis() {
  return {
    hgetall: vi.fn(),
    hset: vi.fn(),
    eval: vi.fn(),
    hincrby: vi.fn(),
    set: vi.fn(),
    zadd: vi.fn(),
  }
}

describe('RedisStore', () => {
  let mockRedis: ReturnType<typeof createMockRedis>
  let store: RedisStore

  beforeEach(() => {
    mockRedis = createMockRedis()
    store = new RedisStore(mockRedis as any)
  })

  describe('getClient', () => {
    it('should return null when client does not exist', async () => {
      mockRedis.hgetall.mockResolvedValue({})
      const result = await store.getClient('nonexistent')
      expect(result).toBeNull()
      expect(mockRedis.hgetall).toHaveBeenCalledWith('stripe402:client:nonexistent')
    })

    it('should return null when hgetall returns empty data without clientId', async () => {
      mockRedis.hgetall.mockResolvedValue({ balance: '100' })
      const result = await store.getClient('partial')
      expect(result).toBeNull()
    })

    it('should return a ClientRecord when client exists', async () => {
      const now = new Date().toISOString()
      mockRedis.hgetall.mockResolvedValue({
        clientId: 'client123',
        stripeCustomerId: 'cus_abc',
        balance: '500',
        currency: 'usd',
        createdAt: now,
        updatedAt: now,
      })

      const result = await store.getClient('client123')
      expect(result).not.toBeNull()
      expect(result!.clientId).toBe('client123')
      expect(result!.stripeCustomerId).toBe('cus_abc')
      expect(result!.balance).toBe(500)
      expect(result!.currency).toBe('usd')
      expect(result!.createdAt).toBeInstanceOf(Date)
      expect(result!.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('createClient', () => {
    it('should store client data as a Redis hash', async () => {
      const now = new Date()
      const record: ClientRecord = {
        clientId: 'client123',
        stripeCustomerId: 'cus_abc',
        balance: 500,
        currency: 'usd',
        createdAt: now,
        updatedAt: now,
      }

      await store.createClient(record)

      expect(mockRedis.hset).toHaveBeenCalledWith('stripe402:client:client123', {
        clientId: 'client123',
        stripeCustomerId: 'cus_abc',
        balance: '500',
        currency: 'usd',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      })
    })
  })

  describe('deductBalance', () => {
    it('should return new balance on successful deduction', async () => {
      mockRedis.eval.mockResolvedValue(400)

      const result = await store.deductBalance('client123', 100)
      expect(result).toBe(400)
      expect(mockRedis.eval).toHaveBeenCalledWith(
        expect.stringContaining('local key = KEYS[1]'),
        1,
        'stripe402:client:client123',
        '100',
        expect.any(String)
      )
    })

    it('should return null when balance is insufficient', async () => {
      mockRedis.eval.mockResolvedValue(-1)

      const result = await store.deductBalance('client123', 1000)
      expect(result).toBeNull()
    })

    it('should return 0 when deducting exact balance', async () => {
      mockRedis.eval.mockResolvedValue(0)

      const result = await store.deductBalance('client123', 500)
      expect(result).toBe(0)
    })
  })

  describe('addBalance', () => {
    it('should increment balance and return new value', async () => {
      mockRedis.hincrby.mockResolvedValue(1000)
      mockRedis.hset.mockResolvedValue(1)

      const result = await store.addBalance('client123', 500)
      expect(result).toBe(1000)
      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        'stripe402:client:client123',
        'balance',
        500
      )
      expect(mockRedis.hset).toHaveBeenCalledWith(
        'stripe402:client:client123',
        'updatedAt',
        expect.any(String)
      )
    })
  })

  describe('recordTransaction', () => {
    it('should store transaction and add to sorted set', async () => {
      const now = new Date()
      const txn: TransactionRecord = {
        id: 'txn_123',
        clientId: 'client123',
        type: 'topup',
        amount: 500,
        stripePaymentIntentId: 'pi_abc',
        createdAt: now,
      }

      await store.recordTransaction(txn)

      expect(mockRedis.set).toHaveBeenCalledWith(
        'stripe402:txn:client123:txn_123',
        JSON.stringify(txn)
      )
      expect(mockRedis.zadd).toHaveBeenCalledWith(
        'stripe402:txns:client123',
        now.getTime(),
        'txn_123'
      )
    })

    it('should handle deduction transactions', async () => {
      const now = new Date()
      const txn: TransactionRecord = {
        id: 'txn_456',
        clientId: 'client123',
        type: 'deduction',
        amount: 1,
        resource: 'GET /api/joke',
        createdAt: now,
      }

      await store.recordTransaction(txn)

      expect(mockRedis.set).toHaveBeenCalledWith(
        'stripe402:txn:client123:txn_456',
        expect.stringContaining('"type":"deduction"')
      )
    })
  })
})
