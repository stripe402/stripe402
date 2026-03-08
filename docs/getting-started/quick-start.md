# Quick Start

Get a working stripe402 server running in 5 minutes.

## Option 1: Docker Compose (Easiest)

The example app includes a Docker Compose setup with Redis, PostgreSQL, and the example server:

```bash
# Clone the repo
git clone https://github.com/user/stripe402.git
cd stripe402

# Copy the example env file and add your Stripe test keys
cp apps/example/.env.example apps/example/.env
# Edit apps/example/.env with your keys from https://dashboard.stripe.com/test/apikeys

# Start everything
docker compose up -d

# Test a free endpoint
curl http://localhost:3000/api/health
# => {"status":"ok"}

# Test a paid endpoint (returns 402)
curl -i http://localhost:3000/api/joke
# => HTTP/1.1 402 Payment Required
# => payment-required: <base64 JSON>
```

To stop:

```bash
docker compose down
```

## Option 2: Minimal Server

Create a stripe402 server from scratch:

### 1. Install dependencies

```bash
mkdir my-api && cd my-api
pnpm init
pnpm add @stripe402/express @stripe402/server express stripe ioredis
pnpm add -D typescript @types/express
```

### 2. Create the server

```ts
// server.ts
import express from 'express'
import Redis from 'ioredis'
import { stripe402Middleware } from '@stripe402/express'
import { RedisStore } from '@stripe402/server'

const app = express()
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = new RedisStore(redis)

app.use(
  stripe402Middleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    serverSecret: process.env.SERVER_SECRET ?? 'change-me-in-production',
    store,
    routes: {
      'GET /api/joke': {
        amount: 100,        // 1 cent (100 units)
        minTopUp: 50_000,   // $5.00 minimum charge
        description: 'Random joke',
      },
    },
  })
)

// Free endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' })
})

// Paid endpoint (protected by middleware)
app.get('/api/joke', (_req, res) => {
  res.json({ joke: 'Why do programmers prefer dark mode? Because light attracts bugs.' })
})

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000')
})
```

### 3. Run it

```bash
# Start Redis
docker run -d -p 6379:6379 redis

# Set environment variables
export STRIPE_SECRET_KEY=sk_test_...
export STRIPE_PUBLISHABLE_KEY=pk_test_...

# Run the server
npx ts-node server.ts
```

### 4. Test it

```bash
# Free endpoint works normally
curl http://localhost:3000/api/health
# => {"status":"ok"}

# Paid endpoint returns 402 with payment requirements
curl -i http://localhost:3000/api/joke
# => HTTP/1.1 402 Payment Required
# => payment-required: eyJzdHJpcGU0MDJ...
```

## Minimal Client

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(axios.create(), {
  onPaymentRequired: async (requirements) => {
    // In production, use Stripe.js to tokenize a card
    // For testing, use a Stripe test PaymentMethod
    return {
      paymentMethodId: 'pm_card_visa',   // Stripe test PM
      topUpAmount: requirements.minTopUp, // Top up the minimum
    }
  },
})

// This automatically handles the 402 flow
const response = await client.get('http://localhost:3000/api/joke')
console.log(response.data)
// => { joke: "Why do programmers prefer dark mode?..." }
```

## Next Steps

- [Environment Variables](environment-variables.md) — configure all options
- [Protocol Overview](../protocol/README.md) — understand the payment flow
- [Server Setup Guide](../guides/server-setup.md) — detailed server configuration
- [Client Integration Guide](../guides/client-integration.md) — Axios and Fetch clients
