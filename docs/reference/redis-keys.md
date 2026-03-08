# Redis Key Patterns

All keys used by `RedisStore` are prefixed with `stripe402:`.

## Key Reference

### Client Records

**Pattern**: `stripe402:client:{clientId}`
**Type**: Hash

| Hash Field | Type | Description |
|------------|------|-------------|
| `clientId` | `string` | HMAC-derived client identifier |
| `stripeCustomerId` | `string` | Stripe Customer ID (`cus_...`) |
| `balance` | `string` | Current balance in units (stored as string, parsed as integer) |
| `currency` | `string` | ISO 4217 currency code |
| `createdAt` | `string` | ISO 8601 timestamp |
| `updatedAt` | `string` | ISO 8601 timestamp |

**Example**:

```
HGETALL stripe402:client:7a8b9c0d1e2f...

1) "clientId"
2) "7a8b9c0d1e2f..."
3) "stripeCustomerId"
4) "cus_abc123"
5) "balance"
6) "49500"
7) "currency"
8) "usd"
9) "createdAt"
10) "2024-01-15T10:30:00.000Z"
11) "updatedAt"
12) "2024-01-15T10:31:05.000Z"
```

### Transaction Records

**Pattern**: `stripe402:txn:{clientId}:{transactionId}`
**Type**: String (JSON-serialized `TransactionRecord`)

**Example**:

```
GET stripe402:txn:7a8b9c0d1e2f...:550e8400-e29b-41d4-a716-446655440000

'{"id":"550e8400...","clientId":"7a8b9c0d1e2f...","type":"topup","amount":50000,"stripePaymentIntentId":"pi_abc123","createdAt":"2024-01-15T10:30:00.000Z"}'
```

### Transaction Index

**Pattern**: `stripe402:txns:{clientId}`
**Type**: Sorted Set

- **Score**: Timestamp in milliseconds (`createdAt.getTime()`)
- **Member**: Transaction ID (UUID)

Enables time-ordered lookups:

```
ZRANGEBYSCORE stripe402:txns:7a8b9c0d1e2f... -inf +inf
```

## Lua Deduction Script

The `deductBalance` method uses this Lua script for atomic check-and-deduct:

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

### Script Arguments

| Argument | Description |
|----------|-------------|
| `KEYS[1]` | The client hash key (e.g., `stripe402:client:7a8b...`) |
| `ARGV[1]` | Amount to deduct (string, parsed as number) |
| `ARGV[2]` | Current ISO 8601 timestamp for `updatedAt` |

### Return Values

| Value | Meaning | TypeScript Mapping |
|-------|---------|--------------------|
| `>= 0` | New balance after deduction | `number` |
| `-1` | Insufficient balance, no deduction made | `null` |

### Why Lua?

Redis is single-threaded — Lua scripts execute atomically without any concurrency issues. This means:

- No two requests can read the same balance and both deduct
- No need for Redis transactions (`MULTI`/`EXEC`) or `WATCH`
- The check-and-deduct is guaranteed to be indivisible

## Other Operations

| Operation | Redis Command | Notes |
|-----------|---------------|-------|
| `getClient` | `HGETALL stripe402:client:{id}` | Returns empty object if key doesn't exist |
| `createClient` | `HSET stripe402:client:{id} field1 val1 ...` | Overwrites if exists |
| `addBalance` | `HINCRBY stripe402:client:{id} balance {amount}` | Atomic increment |
| `recordTransaction` | `SET stripe402:txn:{cid}:{tid} {json}` + `ZADD stripe402:txns:{cid} {ts} {tid}` | Two commands |

## Data Persistence

By default, Redis does not persist data to disk. If the Redis server restarts, all client balances and transaction records are lost.

For production, configure Redis persistence:

- **RDB snapshots**: `save 60 1000` (snapshot every 60 seconds if 1000+ keys changed)
- **AOF (Append Only File)**: `appendonly yes` for durability at the cost of performance
- **Managed Redis**: AWS ElastiCache, Redis Cloud, etc. handle persistence automatically
