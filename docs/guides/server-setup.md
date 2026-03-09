# Server Setup Guide

A complete walkthrough for setting up a stripe402 server with Express.

## Prerequisites

- Node.js 22+
- A Stripe account with test API keys
- Redis running locally (or Docker)
- **Publishable key tokenization enabled** in your Stripe dashboard (required for headless clients)

### Enable Publishable Key Tokenization

If your API will serve headless clients (AI agents, CLI tools, server-to-server), you must enable direct card tokenization in your Stripe dashboard:

1. Go to [Stripe Dashboard → Settings → Integration](https://dashboard.stripe.com/settings/integration)
2. Enable **"Publishable key card tokenization"**
3. Save

Stripe shows a warning that this is discouraged for typical web apps — this is expected. stripe402 requires it because programmatic clients cannot interact with Stripe's prebuilt UI elements (Elements, Checkout). This is safe because card details are sent directly to Stripe's servers and the API server only ever sees tokenized `pm_...` IDs. See the [Creating Payment Methods guide](creating-payment-methods.md#stripe-dashboard-requirement-publishable-key-tokenization) for full details.

> **Note**: If your API only serves browser-based clients using Stripe.js Elements, this setting is not required.

## Step 1: Install Dependencies

```bash
pnpm add @stripe402/express @stripe402/server express stripe ioredis
pnpm add -D typescript @types/express
```

## Step 2: Configure Environment

Create a `.env` file:

```bash
# Get these from https://dashboard.stripe.com/test/apikeys
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...

# HMAC secret for client identity — use a strong random string
SERVER_SECRET=your-strong-random-secret-here

# Minimum top-up in units (50000 = $5.00)
MIN_TOP_UP=50000

# Server port
PORT=3000

# Redis connection
REDIS_URL=redis://localhost:6379
```

## Step 3: Choose a Store

### Option A: Redis (Recommended)

```ts
import Redis from 'ioredis'
import { RedisStore } from '@stripe402/server'

const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = new RedisStore(redis)
```

Redis is recommended for most use cases — it's fast, simple, and the Lua script ensures atomic balance operations.

### Option B: PostgreSQL

```ts
import { Pool } from 'pg'
import { PostgresStore } from '@stripe402/server'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const store = new PostgresStore(pool)

// Call once on startup to create tables
await store.createTables()
```

PostgreSQL is better when you need durability guarantees or want to query transaction history with SQL.

## Step 4: Configure Routes

Define which routes require payment. The key format is `"METHOD /path"`:

```ts
const routes = {
  'GET /api/joke': {
    amount: 100,        // 1 cent per request (100 units)
    minTopUp: 50_000,   // $5.00 minimum top-up
    description: 'Random joke',
  },
  'GET /api/weather': {
    amount: 500,        // 5 cents per request (500 units)
    minTopUp: 50_000,
    description: 'Weather data',
  },
  'POST /api/translate': {
    amount: 1000,       // 10 cents per request
    minTopUp: 100_000,  // $10.00 minimum (higher-value API)
    description: 'Text translation',
  },
}
```

### Route Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `amount` | `number` | *(required)* | Price per request in units. |
| `currency` | `string` | `'usd'` | ISO 4217 currency code. |
| `minTopUp` | `number` | `50000` | Minimum charge per top-up in units. |
| `description` | `string` | — | Shown in 402 responses and Stripe charge descriptions. |

## Step 5: Apply Middleware

```ts
import 'dotenv/config'
import express from 'express'
import { stripe402Middleware } from '@stripe402/express'

const app = express()

app.use(
  stripe402Middleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    serverSecret: process.env.SERVER_SECRET ?? 'change-me-in-production',
    store,
    routes,
  })
)
```

The middleware runs before your route handlers. It intercepts requests to paid routes and either challenges with 402, deducts credits, or processes payment — then calls `next()` to let your handler run.

## Step 6: Add Route Handlers

```ts
// Free endpoint — not in the routes map, so no payment required
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Paid endpoints — middleware handles payment before these run
app.get('/api/joke', (_req, res) => {
  res.json({ joke: 'Why do programmers prefer dark mode? Because light attracts bugs.' })
})

app.get('/api/weather', (_req, res) => {
  res.json({ location: 'San Francisco', temperature: 62, conditions: 'Partly cloudy' })
})

app.listen(process.env.PORT ?? 3000)
```

## Step 7: Test

```bash
# Start Redis
docker run -d -p 6379:6379 redis

# Run the server
npx ts-node server.ts

# Test a free endpoint
curl http://localhost:3000/api/health
# => {"status":"ok"}

# Test a paid endpoint (expect 402)
curl -i http://localhost:3000/api/joke
# => HTTP/1.1 402 Payment Required
# => payment-required: eyJzdHJpcGU0MDJ...
```

## Complete Example

See the full working example in [apps/example/src/server.ts](https://github.com/stripe402/stripe402/blob/main/apps/example/src/server.ts).
