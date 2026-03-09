# @stripe402/express

Express middleware that gates routes behind HTTP 402 payment requirements. Handles the 402 challenge, payment processing, credit management, and serving the resource.

## Installation

```bash
pnpm add @stripe402/express @stripe402/server express stripe
```

### Peer Dependencies

| Peer Dependency | Version |
|-----------------|---------|
| `express` | >= 4.0.0 (tested with Express 5.1) |

## Exports

```ts
export { stripe402Middleware } from './middleware'
```

Single export: the `stripe402Middleware` factory function.

## Quick Example

```ts
import express from 'express'
import Redis from 'ioredis'
import { stripe402Middleware } from '@stripe402/express'
import { RedisStore } from '@stripe402/server'

const app = express()
const store = new RedisStore(new Redis())

app.use(
  stripe402Middleware({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    serverSecret: process.env.SERVER_SECRET!,
    store,
    routes: {
      'GET /api/weather': {
        amount: 500,       // 5 cents (500 units)
        minTopUp: 50_000,  // $5.00 minimum charge
        description: 'Weather data',
      },
    },
  })
)

// This handler only runs after payment is verified
app.get('/api/weather', (req, res) => {
  res.json({ temperature: 72, conditions: 'Sunny' })
})
```

## Sub-Pages

- [Middleware](middleware.md) — detailed configuration, code paths, and helper functions
