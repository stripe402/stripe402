# @stripe402/express

Express middleware that protects routes with HTTP 402 payment gates. Handles the full lifecycle: 402 challenge, Stripe payment processing, credit management, and resource delivery.

## Install

```bash
npm install @stripe402/express @stripe402/server
```

## Usage

```ts
import express from 'express'
import Redis from 'ioredis'
import { stripe402Middleware } from '@stripe402/express'
import { RedisStore } from '@stripe402/server'

const app = express()

app.use(stripe402Middleware({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  serverSecret: process.env.SERVER_SECRET!,
  store: new RedisStore(new Redis()),
  routes: {
    'GET /api/weather': {
      amount: 500,       // 5 cents (500 units)
      minTopUp: 50_000,  // $5.00 minimum charge
      description: 'Weather data',
    },
  },
}))

// This handler only runs after payment is verified
app.get('/api/weather', (req, res) => {
  res.json({ temperature: 72, conditions: 'Sunny' })
})
```

Routes not listed in the config pass through to the next middleware untouched.

## Requirements

- Node.js >= 16.0.0
- **Peer dependency**: `express` >= 4.0.0

You also need a store from `@stripe402/server` (Redis or PostgreSQL).

## Part of the stripe402 monorepo

See the [main repository](https://github.com/whatl3y/stripe402) for full documentation and the protocol specification.

## License

Apache-2.0 — see [LICENSE](./LICENSE) for details.
