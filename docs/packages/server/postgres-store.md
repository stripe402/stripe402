# PostgresStore

A PostgreSQL-based implementation of `Stripe402Store` with full transaction audit logging and SQL-level atomicity.

## Constructor

```ts
import { Pool } from 'pg'

new PostgresStore(pool: Pool)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pool` | `Pool` | A `pg.Pool` instance for connection pooling. |

### Example

```ts
import { Pool } from 'pg'
import { PostgresStore } from '@stripe402/server'

const pool = new Pool({
  connectionString: 'postgresql://stripe402:stripe402@localhost:5433/stripe402',
})
const store = new PostgresStore(pool)

// Create tables on startup (idempotent)
await store.createTables()
```

## Table Schema

### `createTables()`

Call once on application startup. Creates tables if they don't exist (idempotent via `CREATE TABLE IF NOT EXISTS`).

```ts
async createTables(): Promise<void>
```

### `stripe402_clients`

Stores client records and credit balances.

```sql
CREATE TABLE IF NOT EXISTS stripe402_clients (
  client_id TEXT PRIMARY KEY,
  stripe_customer_id TEXT NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'usd',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `client_id` | `TEXT` | `PRIMARY KEY` | HMAC-derived client identifier (64-char hex). |
| `stripe_customer_id` | `TEXT` | `NOT NULL` | Stripe Customer ID (`cus_...`). |
| `balance` | `INTEGER` | `NOT NULL DEFAULT 0` | Current balance in units. |
| `currency` | `TEXT` | `NOT NULL DEFAULT 'usd'` | ISO 4217 currency code. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last modification timestamp. |

### `stripe402_transactions`

Stores transaction audit log entries.

```sql
CREATE TABLE IF NOT EXISTS stripe402_transactions (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL REFERENCES stripe402_clients(client_id),
  type TEXT NOT NULL CHECK (type IN ('topup', 'deduction')),
  amount INTEGER NOT NULL,
  stripe_payment_intent_id TEXT,
  resource TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_stripe402_transactions_client_id
  ON stripe402_transactions(client_id);
```

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | `TEXT` | `PRIMARY KEY` | UUID transaction identifier. |
| `client_id` | `TEXT` | `NOT NULL`, `REFERENCES stripe402_clients(client_id)` | Foreign key to client. |
| `type` | `TEXT` | `NOT NULL`, `CHECK (type IN ('topup', 'deduction'))` | Transaction type. |
| `amount` | `INTEGER` | `NOT NULL` | Amount in units. |
| `stripe_payment_intent_id` | `TEXT` | *(nullable)* | Stripe PI ID (top-ups only). |
| `resource` | `TEXT` | *(nullable)* | Route key (deductions only), e.g., `'GET /api/joke'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Transaction timestamp. |

**Index**: `idx_stripe402_transactions_client_id` on `client_id` for efficient lookups.

## Method Implementations

### `getClient(clientId)`

```sql
SELECT * FROM stripe402_clients WHERE client_id = $1
```

Returns `null` if no rows match. Maps `snake_case` columns to `camelCase` TypeScript fields.

### `createClient(record)`

```sql
INSERT INTO stripe402_clients (client_id, stripe_customer_id, balance, currency, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (client_id) DO NOTHING
```

The `ON CONFLICT DO NOTHING` makes this idempotent — duplicate inserts are silently ignored.

### `deductBalance(clientId, amount)`

```sql
UPDATE stripe402_clients
SET balance = balance - $1, updated_at = NOW()
WHERE client_id = $2 AND balance >= $1
RETURNING balance
```

**Atomicity**: The `WHERE balance >= $1` clause ensures the deduction only happens if the balance is sufficient. If the balance is too low, no rows are updated and the `RETURNING` clause returns no rows — mapped to `null`.

This is atomic because PostgreSQL executes the entire `UPDATE ... WHERE ... RETURNING` statement as a single operation with row-level locking.

### `addBalance(clientId, amount)`

```sql
UPDATE stripe402_clients
SET balance = balance + $1, updated_at = NOW()
WHERE client_id = $2
RETURNING balance
```

Returns the new balance.

### `recordTransaction(transaction)`

```sql
INSERT INTO stripe402_transactions (id, client_id, type, amount, stripe_payment_intent_id, resource, created_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
```

Nullable fields (`stripePaymentIntentId`, `resource`) are passed as `null` when not present.
