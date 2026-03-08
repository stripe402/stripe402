# Store Interface

The `Stripe402Store` interface defines the contract for persistence backends in stripe402. Any class implementing this interface can be used as the `store` in `Stripe402ServerConfig`.

## Interface Definition

```ts
interface Stripe402Store {
  getClient(clientId: string): Promise<ClientRecord | null>
  createClient(record: ClientRecord): Promise<void>
  deductBalance(clientId: string, amount: number): Promise<number | null>
  addBalance(clientId: string, amount: number): Promise<number>
  recordTransaction?(transaction: TransactionRecord): Promise<void>
}
```

## Methods

### `getClient(clientId: string): Promise<ClientRecord | null>`

Look up a client by their HMAC-derived identifier.

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | `string` | 64-character hex string from `deriveClientId()`. |

**Returns**: The `ClientRecord` if found, or `null` if no client exists with that ID.

---

### `createClient(record: ClientRecord): Promise<void>`

Create a new client record. If a record with the same `clientId` already exists, implementations should either ignore the duplicate (idempotent) or throw.

| Parameter | Type | Description |
|-----------|------|-------------|
| `record` | `ClientRecord` | The full client record to create. |

**Implementations**:
- **RedisStore**: Uses `hset` — overwrites if exists
- **PostgresStore**: Uses `INSERT ... ON CONFLICT DO NOTHING` — idempotent

---

### `deductBalance(clientId: string, amount: number): Promise<number | null>`

Atomically deduct from a client's balance. **This method must be atomic** — it must check that `balance >= amount` and deduct in a single operation to prevent double-spending under concurrent requests.

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | `string` | The client identifier. |
| `amount` | `number` | Amount to deduct in units. |

**Returns**:
- `number` — the new balance after deduction, if `balance >= amount`
- `null` — if the balance is insufficient (no deduction was made)

**Atomicity requirement**: This is the most critical method. Without atomicity, two concurrent requests could both read the same balance and both deduct, resulting in a negative balance. Implementations must use database-level guarantees:

- **Redis**: Lua script (single-threaded execution guarantees atomicity)
- **PostgreSQL**: `UPDATE ... WHERE balance >= amount RETURNING balance` (the WHERE clause prevents negative balances)

---

### `addBalance(clientId: string, amount: number): Promise<number>`

Add credits to a client's balance. Returns the new balance.

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | `string` | The client identifier. |
| `amount` | `number` | Amount to add in units. |

**Returns**: `number` — the new balance after addition.

---

### `recordTransaction?(transaction: TransactionRecord): Promise<void>`

Record a transaction for audit logging. **This method is optional** — the `?` in the interface means stores can omit it entirely.

| Parameter | Type | Description |
|-----------|------|-------------|
| `transaction` | `TransactionRecord` | The transaction to record. |

The middleware checks `if (config.store.recordTransaction)` before calling this method. Stores that don't need audit logging can simply not implement it.

Both built-in stores (`RedisStore` and `PostgresStore`) implement this method.

## Implementing a Custom Store

See the [Custom Store Backend](../../guides/custom-store.md) guide for a walkthrough of building your own `Stripe402Store` implementation.
