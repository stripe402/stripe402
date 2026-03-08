# PostgreSQL Schema

The `PostgresStore` creates two tables and one index. These are created by calling `store.createTables()` on application startup.

## `stripe402_clients`

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

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `client_id` | `TEXT` | `PRIMARY KEY` | — | HMAC-derived client identifier. 64-character hex string. |
| `stripe_customer_id` | `TEXT` | `NOT NULL` | — | Stripe Customer ID (`cus_...`). |
| `balance` | `INTEGER` | `NOT NULL` | `0` | Current credit balance in units (1 unit = 1/10,000 dollar). |
| `currency` | `TEXT` | `NOT NULL` | `'usd'` | ISO 4217 currency code. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Record creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Last modification timestamp. Updated on balance changes. |

### Key Operations

**Atomic balance deduction**:

```sql
UPDATE stripe402_clients
SET balance = balance - $1, updated_at = NOW()
WHERE client_id = $2 AND balance >= $1
RETURNING balance
```

The `WHERE balance >= $1` clause ensures the deduction only succeeds if the balance is sufficient. This is atomic — PostgreSQL acquires a row-level lock for the UPDATE.

**Idempotent client creation**:

```sql
INSERT INTO stripe402_clients (client_id, stripe_customer_id, balance, currency, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6)
ON CONFLICT (client_id) DO NOTHING
```

## `stripe402_transactions`

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
```

| Column | Type | Constraints | Default | Description |
|--------|------|-------------|---------|-------------|
| `id` | `TEXT` | `PRIMARY KEY` | — | UUID transaction identifier. |
| `client_id` | `TEXT` | `NOT NULL`, `REFERENCES stripe402_clients(client_id)` | — | Foreign key to the client. |
| `type` | `TEXT` | `NOT NULL`, `CHECK (type IN ('topup', 'deduction'))` | — | Transaction type. |
| `amount` | `INTEGER` | `NOT NULL` | — | Amount in units. |
| `stripe_payment_intent_id` | `TEXT` | *(nullable)* | `NULL` | Stripe PaymentIntent ID. Present for `topup` transactions. |
| `resource` | `TEXT` | *(nullable)* | `NULL` | Route key (e.g., `'GET /api/joke'`). Present for `deduction` transactions. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL` | `NOW()` | Transaction timestamp. |

### Constraints

- **Foreign key**: `client_id` references `stripe402_clients(client_id)` — transactions can only be recorded for existing clients.
- **Check constraint**: `type` must be either `'topup'` or `'deduction'`.

## Index

```sql
CREATE INDEX IF NOT EXISTS idx_stripe402_transactions_client_id
  ON stripe402_transactions(client_id);
```

Enables efficient lookups of all transactions for a given client.

## Useful Queries

### Check a client's balance

```sql
SELECT client_id, balance, currency, updated_at
FROM stripe402_clients
WHERE client_id = 'abc123...';
```

### Get transaction history for a client

```sql
SELECT id, type, amount, stripe_payment_intent_id, resource, created_at
FROM stripe402_transactions
WHERE client_id = 'abc123...'
ORDER BY created_at DESC;
```

### Total revenue by route

```sql
SELECT resource, SUM(amount) as total_units, COUNT(*) as request_count
FROM stripe402_transactions
WHERE type = 'deduction'
GROUP BY resource
ORDER BY total_units DESC;
```

### Total top-ups by client

```sql
SELECT client_id, SUM(amount) as total_topped_up, COUNT(*) as topup_count
FROM stripe402_transactions
WHERE type = 'topup'
GROUP BY client_id
ORDER BY total_topped_up DESC;
```
