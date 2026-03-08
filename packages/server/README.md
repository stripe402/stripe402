# @stripe402/server

Server-side Stripe integration and persistence stores for the stripe402 protocol. Framework-agnostic — provides the building blocks that framework-specific middleware packages (like `@stripe402/express`) use.

## Install

```bash
npm install @stripe402/server
```

## Usage

### StripeService

Handles PaymentIntent creation, card fingerprint retrieval, and customer management.

```ts
import { StripeService } from '@stripe402/server'

const stripe = new StripeService(process.env.STRIPE_SECRET_KEY!)

const intent = await stripe.createAndConfirmPayment({
  amount: 500,       // in Stripe cents
  currency: 'usd',
  paymentMethodId: 'pm_...',
  customerId: 'cus_...',
})

const fingerprint = await stripe.getCardFingerprint('pm_...')
const customer = await stripe.findOrCreateCustomer(clientId, 'pm_...')
```

### RedisStore

Fast credit balance storage using Redis with Lua scripts for atomic deduction.

```ts
import Redis from 'ioredis'
import { RedisStore } from '@stripe402/server'

const store = new RedisStore(new Redis())

await store.addBalance('client123', 50_000)
const remaining = await store.deductBalance('client123', 100) // returns new balance or null
```

### PostgresStore

Durable credit balance storage with transaction audit logging.

```ts
import { Pool } from 'pg'
import { PostgresStore } from '@stripe402/server'

const store = new PostgresStore(new Pool({ connectionString: DATABASE_URL }))
await store.createTables() // run once on startup
```

Both stores implement the `Stripe402Store` interface from `@stripe402/core`.
