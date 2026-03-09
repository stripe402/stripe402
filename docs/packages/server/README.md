# @stripe402/server

Stripe API integration and persistence stores (Redis, PostgreSQL). Framework-agnostic — it provides the building blocks that framework-specific middleware packages like `@stripe402/express` use.

## Installation

```bash
pnpm add @stripe402/server stripe
```

### Peer Dependencies

| Peer Dependency | Required? | Notes |
|-----------------|-----------|-------|
| `ioredis` >= 5.0.0 | If using `RedisStore` | Redis client library |
| `pg` >= 8.0.0 | If using `PostgresStore` | PostgreSQL client library |

## Exports

```ts
export { StripeService } from './stripe'
export { RedisStore } from './store/redis'
export { PostgresStore } from './store/postgres'
```

| Export | Description |
|--------|-------------|
| `StripeService` | Wrapper around the Stripe SDK for payment processing |
| `RedisStore` | Redis-based `Stripe402Store` implementation with Lua atomics |
| `PostgresStore` | PostgreSQL-based `Stripe402Store` implementation |

## Sub-Pages

- [StripeService](stripe-service.md) — Stripe API integration (PaymentIntents, customers, fingerprints)
- [Store Interface](store-interface.md) — The `Stripe402Store` contract and atomicity requirements
- [RedisStore](redis-store.md) — Redis implementation with Lua scripts
- [PostgresStore](postgres-store.md) — PostgreSQL implementation with SQL schema
