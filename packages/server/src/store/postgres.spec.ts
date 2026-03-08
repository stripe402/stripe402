import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PostgresStore } from './postgres'
import type { ClientRecord, TransactionRecord } from '@stripe402/core'

function createMockPool() {
  return {
    query: vi.fn(),
  }
}

describe('PostgresStore', () => {
  let mockPool: ReturnType<typeof createMockPool>
  let store: PostgresStore

  beforeEach(() => {
    mockPool = createMockPool()
    store = new PostgresStore(mockPool as any)
  })

  describe('createTables', () => {
    it('should execute CREATE TABLE statements', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      await store.createTables()

      expect(mockPool.query).toHaveBeenCalledTimes(1)
      const sql = mockPool.query.mock.calls[0][0] as string
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS stripe402_clients')
      expect(sql).toContain('CREATE TABLE IF NOT EXISTS stripe402_transactions')
      expect(sql).toContain('CREATE INDEX IF NOT EXISTS idx_stripe402_transactions_client_id')
    })
  })

  describe('getClient', () => {
    it('should return null when no rows found', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await store.getClient('nonexistent')
      expect(result).toBeNull()
      expect(mockPool.query).toHaveBeenCalledWith(
        'SELECT * FROM stripe402_clients WHERE client_id = $1',
        ['nonexistent']
      )
    })

    it('should return a mapped ClientRecord when found', async () => {
      const now = new Date()
      mockPool.query.mockResolvedValue({
        rows: [{
          client_id: 'client123',
          stripe_customer_id: 'cus_abc',
          balance: 500,
          currency: 'usd',
          created_at: now,
          updated_at: now,
        }],
      })

      const result = await store.getClient('client123')
      expect(result).toEqual({
        clientId: 'client123',
        stripeCustomerId: 'cus_abc',
        balance: 500,
        currency: 'usd',
        createdAt: now,
        updatedAt: now,
      })
    })
  })

  describe('createClient', () => {
    it('should insert with ON CONFLICT DO NOTHING', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const now = new Date()
      const record: ClientRecord = {
        clientId: 'client123',
        stripeCustomerId: 'cus_abc',
        balance: 0,
        currency: 'usd',
        createdAt: now,
        updatedAt: now,
      }

      await store.createClient(record)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('ON CONFLICT (client_id) DO NOTHING'),
        ['client123', 'cus_abc', 0, 'usd', now, now]
      )
    })
  })

  describe('deductBalance', () => {
    it('should return new balance on successful deduction', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ balance: 400 }] })
      const result = await store.deductBalance('client123', 100)
      expect(result).toBe(400)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE client_id = $2 AND balance >= $1'),
        [100, 'client123']
      )
    })

    it('should return null when balance is insufficient', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
      const result = await store.deductBalance('client123', 1000)
      expect(result).toBeNull()
    })
  })

  describe('addBalance', () => {
    it('should increment and return new balance', async () => {
      mockPool.query.mockResolvedValue({ rows: [{ balance: 1000 }] })
      const result = await store.addBalance('client123', 500)
      expect(result).toBe(1000)

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('balance = balance + $1'),
        [500, 'client123']
      )
    })
  })

  describe('recordTransaction', () => {
    it('should insert a topup transaction', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
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

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stripe402_transactions'),
        ['txn_123', 'client123', 'topup', 500, 'pi_abc', null, now]
      )
    })

    it('should insert a deduction transaction with resource', async () => {
      mockPool.query.mockResolvedValue({ rows: [] })
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

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO stripe402_transactions'),
        ['txn_456', 'client123', 'deduction', 1, null, 'GET /api/joke', now]
      )
    })
  })
})
