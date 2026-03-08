# Custom Store Backend

How to implement a custom `Stripe402Store` for backends other than Redis or PostgreSQL.

## The Interface

Your store must implement the `Stripe402Store` interface from `@stripe402/core`:

```ts
interface Stripe402Store {
  getClient(clientId: string): Promise<ClientRecord | null>
  createClient(record: ClientRecord): Promise<void>
  deductBalance(clientId: string, amount: number): Promise<number | null>
  addBalance(clientId: string, amount: number): Promise<number>
  recordTransaction?(transaction: TransactionRecord): Promise<void>
}
```

## Critical Requirement: Atomic `deductBalance`

The `deductBalance` method **must be atomic**. It must check that `balance >= amount` and perform the deduction in a single, indivisible operation. Without this, concurrent requests can double-spend credits.

**Bad** (race condition):

```ts
// DON'T DO THIS — not atomic
async deductBalance(clientId, amount) {
  const client = await this.getClient(clientId)
  if (client.balance >= amount) {
    // Between this read and the write, another request could deduct too
    await this.updateBalance(clientId, client.balance - amount)
    return client.balance - amount
  }
  return null
}
```

**Good** (atomic):

```ts
// Redis: Lua script runs atomically
// PostgreSQL: UPDATE ... WHERE balance >= amount RETURNING balance
// MongoDB: findOneAndUpdate with $gte condition
// DynamoDB: UpdateItem with ConditionExpression
```

## Example: In-Memory Store (for testing)

```ts
import type { ClientRecord, Stripe402Store, TransactionRecord } from '@stripe402/core'

export class MemoryStore implements Stripe402Store {
  private clients = new Map<string, ClientRecord>()
  private transactions: TransactionRecord[] = []

  async getClient(clientId: string): Promise<ClientRecord | null> {
    return this.clients.get(clientId) ?? null
  }

  async createClient(record: ClientRecord): Promise<void> {
    if (!this.clients.has(record.clientId)) {
      this.clients.set(record.clientId, { ...record })
    }
  }

  async deductBalance(clientId: string, amount: number): Promise<number | null> {
    const client = this.clients.get(clientId)
    if (!client || client.balance < amount) return null

    client.balance -= amount
    client.updatedAt = new Date()
    return client.balance
  }

  async addBalance(clientId: string, amount: number): Promise<number> {
    const client = this.clients.get(clientId)!
    client.balance += amount
    client.updatedAt = new Date()
    return client.balance
  }

  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    this.transactions.push({ ...transaction })
  }
}
```

**Note**: This in-memory implementation is **not safe for concurrent requests** in production — JavaScript's single-threaded nature protects against race conditions within a single process, but not across multiple processes or workers. Use a database with proper atomicity for production.

## Example: MongoDB Store Skeleton

```ts
import type { Collection } from 'mongodb'
import type { ClientRecord, Stripe402Store, TransactionRecord } from '@stripe402/core'

export class MongoStore implements Stripe402Store {
  constructor(
    private readonly clients: Collection,
    private readonly transactions: Collection
  ) {}

  async getClient(clientId: string): Promise<ClientRecord | null> {
    const doc = await this.clients.findOne({ clientId })
    if (!doc) return null
    return {
      clientId: doc.clientId,
      stripeCustomerId: doc.stripeCustomerId,
      balance: doc.balance,
      currency: doc.currency,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    }
  }

  async createClient(record: ClientRecord): Promise<void> {
    await this.clients.updateOne(
      { clientId: record.clientId },
      { $setOnInsert: record },
      { upsert: true }
    )
  }

  async deductBalance(clientId: string, amount: number): Promise<number | null> {
    // Atomic: only updates if balance >= amount
    const result = await this.clients.findOneAndUpdate(
      { clientId, balance: { $gte: amount } },
      { $inc: { balance: -amount }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return result ? result.balance : null
  }

  async addBalance(clientId: string, amount: number): Promise<number> {
    const result = await this.clients.findOneAndUpdate(
      { clientId },
      { $inc: { balance: amount }, $set: { updatedAt: new Date() } },
      { returnDocument: 'after' }
    )
    return result!.balance
  }

  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    await this.transactions.insertOne(transaction)
  }
}
```

## Checklist for Custom Stores

- [ ] `getClient` returns `null` (not `undefined`) when client doesn't exist
- [ ] `createClient` is idempotent (duplicate inserts don't error)
- [ ] `deductBalance` is atomic — check and deduct in one operation
- [ ] `deductBalance` returns `null` (not `0` or `-1`) when balance is insufficient
- [ ] `deductBalance` returns the new balance (a number) on success
- [ ] `addBalance` returns the new balance after addition
- [ ] `recordTransaction` is optional — you can omit it entirely
- [ ] Dates are handled correctly (stored and retrieved as `Date` objects)
- [ ] Balance is stored as an integer (units, not dollars or cents)
