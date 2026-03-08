import type Redis from 'ioredis'
import type { ClientRecord, Stripe402Store, TransactionRecord } from '@stripe402/core'

const KEY_PREFIX = 'stripe402:client:'

/**
 * Lua script for atomic balance deduction.
 * Returns the new balance if sufficient funds, or -1 if insufficient.
 */
const DEDUCT_SCRIPT = `
local key = KEYS[1]
local amount = tonumber(ARGV[1])
local balance = tonumber(redis.call('hget', key, 'balance') or '0')
if balance >= amount then
  local newBalance = balance - amount
  redis.call('hset', key, 'balance', newBalance)
  redis.call('hset', key, 'updatedAt', ARGV[2])
  return newBalance
else
  return -1
end
`

export class RedisStore implements Stripe402Store {
  constructor(private readonly redis: Redis) {}

  async getClient(clientId: string): Promise<ClientRecord | null> {
    const data = await this.redis.hgetall(`${KEY_PREFIX}${clientId}`)
    if (!data || !data.clientId) return null

    return {
      clientId: data.clientId,
      stripeCustomerId: data.stripeCustomerId,
      balance: parseInt(data.balance, 10),
      currency: data.currency,
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
    }
  }

  async createClient(record: ClientRecord): Promise<void> {
    const key = `${KEY_PREFIX}${record.clientId}`
    await this.redis.hset(key, {
      clientId: record.clientId,
      stripeCustomerId: record.stripeCustomerId,
      balance: record.balance.toString(),
      currency: record.currency,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    })
  }

  async deductBalance(clientId: string, amount: number): Promise<number | null> {
    const key = `${KEY_PREFIX}${clientId}`
    const result = await this.redis.eval(
      DEDUCT_SCRIPT,
      1,
      key,
      amount.toString(),
      new Date().toISOString()
    ) as number

    return result === -1 ? null : result
  }

  async addBalance(clientId: string, amount: number): Promise<number> {
    const key = `${KEY_PREFIX}${clientId}`
    const newBalance = await this.redis.hincrby(key, 'balance', amount)
    await this.redis.hset(key, 'updatedAt', new Date().toISOString())
    return newBalance
  }

  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    const key = `stripe402:txn:${transaction.clientId}:${transaction.id}`
    await this.redis.set(key, JSON.stringify(transaction))
    // Also add to a sorted set for time-ordered lookups
    await this.redis.zadd(
      `stripe402:txns:${transaction.clientId}`,
      transaction.createdAt.getTime(),
      transaction.id
    )
  }
}
