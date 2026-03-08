# RedisStore

A Redis-based implementation of `Stripe402Store` that uses Lua scripts for atomic balance operations.

## Constructor

```ts
import Redis from 'ioredis'

new RedisStore(redis: Redis)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `redis` | `Redis` | An ioredis client instance. |

### Example

```ts
import Redis from 'ioredis'
import { RedisStore } from '@stripe402/server'

const redis = new Redis('redis://localhost:6379')
const store = new RedisStore(redis)
```

## Key Patterns

All keys are prefixed with `stripe402:`.

### Client Records

**Key**: `stripe402:client:{clientId}`
**Type**: Redis Hash

| Hash Field | Type | Description |
|------------|------|-------------|
| `clientId` | `string` | HMAC-derived client identifier |
| `stripeCustomerId` | `string` | Stripe Customer ID |
| `balance` | `string` | Current balance in units (stored as string, parsed as integer) |
| `currency` | `string` | ISO 4217 currency code |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp |

### Transaction Records

**Key**: `stripe402:txn:{clientId}:{transactionId}`
**Type**: String (JSON-serialized `TransactionRecord`)

### Transaction Index

**Key**: `stripe402:txns:{clientId}`
**Type**: Sorted Set (score = timestamp in milliseconds, member = transaction ID)

This sorted set enables time-ordered lookups of all transactions for a client.

## Atomic Balance Deduction (Lua Script)

The `deductBalance` method uses a Lua script to ensure atomic check-and-deduct:

```lua
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
```

**How it works**:
1. Reads the current balance from the hash
2. Checks if `balance >= amount`
3. If sufficient: sets the new balance and updates the timestamp, returns the new balance
4. If insufficient: returns `-1` (mapped to `null` in TypeScript)

Because Redis executes Lua scripts atomically (single-threaded), this prevents race conditions where two concurrent requests could both read the same balance and both deduct.

## Method Implementations

### `getClient(clientId)`

Calls `redis.hgetall(key)`. Returns `null` if the hash doesn't exist or has no `clientId` field. Parses `balance` as an integer and `createdAt`/`updatedAt` as `Date` objects.

### `createClient(record)`

Calls `redis.hset(key, { ... })` with all fields serialized as strings. `balance` is converted via `.toString()`, dates via `.toISOString()`.

### `deductBalance(clientId, amount)`

Executes the Lua script via `redis.eval()`. Maps the return value: `-1` becomes `null`, any other value is the new balance.

### `addBalance(clientId, amount)`

Calls `redis.hincrby(key, 'balance', amount)` for atomic increment. Also updates the `updatedAt` field via `redis.hset()`. Returns the new balance.

### `recordTransaction(transaction)`

Two operations:
1. `redis.set(txnKey, JSON.stringify(transaction))` — stores the full transaction as JSON
2. `redis.zadd(txnsKey, timestamp, transactionId)` — adds to the sorted set index
