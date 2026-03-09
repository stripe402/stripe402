# stripe402

An HTTP 402 payment protocol for API monetization using Stripe. Inspired by [x402](https://x402.org), but built on traditional credit card rails instead of blockchain settlement.

## Methodology

### The Protocol

stripe402 uses the HTTP 402 status code — reserved since 1997 but never standardized — to create a machine-readable payment negotiation between client and server:

```
1. Client requests a paid resource
   GET /api/weather

2. Server responds with 402 + payment requirements
   HTTP 402 Payment Required
   payment-required: <base64 JSON with price, Stripe publishable key, min top-up>

3. Client tokenizes card via Stripe.js, retries with payment header
   GET /api/weather
   payment: <base64 JSON with PaymentMethod ID, top-up amount>

4. Server charges card via Stripe, credits balance, serves resource
   HTTP 200 OK
   payment-response: <base64 JSON with client ID, remaining credits>

5. Subsequent requests use the client ID — no payment until credits run out
   GET /api/weather
   payment: <base64 JSON with client ID>
```

No signup, no API keys, no OAuth. The payment *is* the authentication. A client's identity is derived deterministically from their card fingerprint via HMAC — same card, same identity, every time.

### Credits Model

Stripe charges a minimum of $0.50 with a $0.30 fixed fee per transaction. True per-request micropayments are uneconomical. stripe402 solves this with a credits system: clients top up once (e.g., $5.00), then make hundreds of requests against that balance at sub-cent prices. When credits run out, the server issues a new 402 to prompt a top-up.

### Why Not x402?

Coinbase's [x402](https://x402.org) protocol proved the concept — HTTP-native, machine-readable payment negotiation is powerful. But it requires clients to hold crypto wallets with USDC on Base or Solana, which limits adoption to the small fraction of users and services with on-chain infrastructure.

stripe402 brings the same protocol pattern to credit cards, the payment rail used by 99% of the internet:

| | x402 (crypto) | stripe402 |
|---|---|---|
| Payment rail | USDC on Base/Solana | Credit cards via Stripe |
| Client needs | Crypto wallet + stablecoins | A credit card |
| Server needs | Wallet address | Stripe account |
| Micropayments | Native (sub-cent) | Via credits system ($5+ top-ups) |
| Stateless | Yes | No (server tracks balances) |
| Adoption barrier | High | **Low** |
| Regulatory complexity | High | **Low** |

**The trade-off is statefulness.** x402 is stateless — each payment is settled on-chain in the request. stripe402 requires the server to maintain credit balances. This is the cost of using traditional payment rails, but it's a familiar problem with well-understood solutions (Redis, PostgreSQL, atomic operations).

### What problem does this solve?

Today, API monetization requires one of: API key provisioning with billing dashboards (Stripe Billing, AWS Marketplace), OAuth + subscription tiers, or crypto wallets (x402). All require signup, account creation, or specialized infrastructure.

stripe402 skips all of that. A client with a credit card can pay for any stripe402-enabled API on the first request. No dashboard, no registration, no approval process. The 402 response tells the client what it costs and how to pay.

### Agentic Payments

Today, when an agent discovers a useful API, it can't use it without a human creating an account, generating API keys, and configuring billing.

With stripe402, an agent can:
1. Discover an API endpoint
2. Receive pricing information in a machine-readable 402 response
3. Pay with a pre-authorized card (via a stored PaymentMethod ID)
4. Use the resource immediately
5. Continue making requests against its credit balance

No human in the loop. The agent treats payment as just another HTTP header.

## Pricing Units

All amounts in stripe402 are expressed in **units**, where 1 unit = 1/10,000 of a dollar. This allows sub-cent pricing for high-volume, low-cost API calls:

| Units | Dollars | Cents |
|-------|---------|-------|
| 1 | $0.0001 | 0.01¢ |
| 100 | $0.01 | 1¢ |
| 500 | $0.05 | 5¢ |
| 10,000 | $1.00 | 100¢ |
| 50,000 | $5.00 | 500¢ |

When charging via Stripe, units are automatically converted to cents (rounded up to the nearest cent).

## Protocol Details

### HTTP Headers

| Header | Direction | Content |
|--------|-----------|---------|
| `payment-required` | Server → Client (402) | Base64 JSON: price, currency, min top-up, Stripe publishable key |
| `payment` | Client → Server (retry) | Base64 JSON: PaymentMethod ID or client ID, top-up amount |
| `payment-response` | Server → Client (200) | Base64 JSON: charge ID, remaining credits, client ID |

### Client Identity

Clients don't create accounts. Identity is derived deterministically:

```
clientId = HMAC-SHA256(stripe_card_fingerprint, server_secret)
```

- Same card on the same server always produces the same client ID
- Different servers produce different IDs (can't correlate across services)
- The card fingerprint can't be recovered from the client ID
- No passwords, no email, no registration

### Persistence

The server maintains credit balances. Two storage backends are included:

- **Redis** — Fast, uses Lua scripts for atomic balance deduction
- **PostgreSQL** — Durable, with transaction audit logging

Both implement the `Stripe402Store` interface, making it easy to add new backends.

## Packages

### `@stripe402/core`

Protocol types, header encoding/decoding, HMAC identity derivation, and error types. Zero external dependencies (Node.js crypto only).

```ts
import { encodeHeader, decodeHeader, deriveClientId } from '@stripe402/core'
```

### `@stripe402/server`

Core server-side logic: Stripe PaymentIntent integration, and persistence stores (Redis, PostgreSQL). This package is framework-agnostic — it provides the building blocks that framework-specific middleware packages use.

```ts
import { StripeService, RedisStore, PostgresStore } from '@stripe402/server'
```

**Redis store** (default):

```ts
import Redis from 'ioredis'
import { RedisStore } from '@stripe402/server'

// Defaults to redis://localhost:6379 when REDIS_URL is not set
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = new RedisStore(redis)
```

**PostgreSQL store:**

```ts
import { PostgresStore } from '@stripe402/server'
import { Pool } from 'pg'

// Requires DATABASE_URL (e.g. postgresql://user:pass@localhost:5432/stripe402)
const store = new PostgresStore(new Pool({ connectionString: process.env.DATABASE_URL }))
await store.createTables() // Run once on startup
```

### `@stripe402/express`

Express middleware that protects routes with 402 payment gates. Handles the full lifecycle: 402 challenge, payment processing via `@stripe402/server`, credit management, and resource delivery.

```ts
import express from 'express'
import Redis from 'ioredis'
import { stripe402Middleware } from '@stripe402/express'
import { RedisStore } from '@stripe402/server'

const app = express()

// Configure persistence — defaults to local Redis on port 6379
const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
const store = new RedisStore(redis)

app.use(stripe402Middleware({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  serverSecret: process.env.SERVER_SECRET ?? 'change-me-in-production',
  store,
  routes: {
    'GET /api/weather': {
      amount: 500,       // 5 cents per request (500 units)
      minTopUp: 50_000,  // $5.00 minimum charge (50000 units)
      description: 'Weather data',
    },
  },
}))

app.get('/api/weather', (req, res) => {
  // This only runs after payment is verified
  res.json({ temperature: 72, conditions: 'Sunny' })
})
```

### `@stripe402/client-axios`

Axios interceptor that automatically handles 402 responses. When a paid endpoint returns 402, the interceptor calls your callback to get payment details, then retries the request.

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(axios.create(), {
  onPaymentRequired: async (requirements) => {
    // Use Stripe.js to tokenize a card, or return a stored PaymentMethod
    const pm = await stripe.createPaymentMethod(/* ... */)
    return { paymentMethodId: pm.id, topUpAmount: requirements.minTopUp }
  },
})

// Automatically handles 402 → payment → retry
const response = await client.get('https://api.example.com/api/weather')
```

### `@stripe402/client-fetch`

Same behavior as the Axios client, but wraps the native `fetch` API.

```ts
import { createStripe402Fetch } from '@stripe402/client-fetch'

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    return { paymentMethodId: 'pm_...', topUpAmount: requirements.minTopUp }
  },
})

const response = await fetchWithPayment('https://api.example.com/api/weather')
const data = await response.json()
```

### `@stripe402/example`

Working demo with a server (Express + Redis) and client scripts (Axios + Fetch) that demonstrate the full 402 payment flow.

#### Quick Start with Docker Compose

The easiest way to run the example is via Docker Compose, which starts Redis and the example server together:

```bash
# 1. Copy the example env file and add your Stripe test keys
cp apps/example/.env.example apps/example/.env
# Edit apps/example/.env with your Stripe keys from https://dashboard.stripe.com/test/apikeys

# 2. Start the server + Redis
docker compose up -d

# 3. Test a free endpoint
curl http://localhost:3000/api/health

# 4. Test a paid endpoint (returns 402)
curl -i http://localhost:3000/api/joke
```

To stop everything:

```bash
docker compose down
```

#### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `STRIPE_SECRET_KEY` | Yes | Stripe secret key (`sk_test_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (`pk_test_...`) |
| `SERVER_SECRET` | No | HMAC secret for client identity (defaults to `change-me-in-production`) |
| `MIN_TOP_UP` | No | Minimum top-up amount in units (1 unit = 1/10000 dollar, defaults to `50000` = $5.00) |
| `PORT` | No | Server port (defaults to `3000`) |
| `REDIS_URL` | No | Redis connection URL (defaults to `redis://redis:6379` in Docker, `redis://localhost:6379` locally) |
| `DATABASE_URL` | No | PostgreSQL connection URL (for `PostgresStore`; not used by default) |
| `TEST_PAYMENT_METHOD_ID` | No | Stripe test PaymentMethod ID for client demos |
| `API_URL` | No | API URL for client demos (defaults to `http://localhost:3000`) |

#### Running Locally (without Docker)

```bash
# Start Redis
docker compose up -d redis

# Install and build
pnpm install && pnpm build

# Start the example server
cd apps/example
cp .env.example .env  # Add your Stripe test keys
pnpm dev

# Run the client demos (in another terminal)
cd apps/example
pnpm demo:axios
pnpm demo:fetch
```

## Design Decisions

### Why not raw card numbers?

Handling raw card numbers requires SAQ-D PCI compliance (300+ security requirements, annual audits). By using Stripe.js for client-side tokenization, servers stay at SAQ-A (22 requirements). Card data never touches your infrastructure.

### Why HMAC for client identity?

- **Deterministic**: Same card always maps to the same client ID on a given server
- **Private**: Card fingerprint can't be recovered from the ID
- **Isolated**: Different servers produce different IDs, preventing cross-service tracking
- **No registration**: Identity is derived from the payment itself

### Why not use Stripe's built-in customer balance?

Stripe's `customer.balance` is tightly coupled to their invoicing system — it automatically applies to the next invoice rather than being a general-purpose wallet. For a flexible credits system with per-request deductions, a custom ledger with atomic operations is more appropriate.

### Why atomic balance operations?

Concurrent API requests from the same client must not overdraw the balance. Both stores use database-level atomicity:

- **Redis**: Lua script that checks and deducts in a single atomic operation
- **PostgreSQL**: `UPDATE ... WHERE balance >= amount RETURNING balance` — the WHERE clause prevents negative balances

### Why base64 headers?

Following x402's convention: payment data is JSON-encoded then base64-encoded in HTTP headers. This keeps the response body free for application use (e.g., an HTML paywall page on 402, or the actual resource on 200).

## Monorepo Structure

```
stripe402/
├── packages/
│   ├── core/              # @stripe402/core — protocol types + utilities
│   ├── server/            # @stripe402/server — Stripe integration + persistence stores
│   ├── express/           # @stripe402/express — Express middleware
│   ├── client-axios/      # @stripe402/client-axios — Axios wrapper
│   └── client-fetch/      # @stripe402/client-fetch — Fetch wrapper
├── apps/
│   └── example/           # @stripe402/example — demo app
├── package.json           # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── vitest.config.ts
├── docker-compose.yml     # Redis + Postgres + example server
└── .dockerignore
```

All publishable libraries live in `packages/`. Only runnable applications (demos, CLIs) live in `apps/`. This makes the distinction clear: everything in `packages/` is something a user would `npm install`.

Built with **pnpm workspaces** and **TypeScript**. No build orchestrator — just `pnpm -r build`.

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Clean build artifacts
pnpm clean
```

## Known Limitations

- **3D Secure / SCA**: EU cards may require interactive authentication, which breaks headless/machine-to-machine flows. Low-value exemptions may apply.
- **Stripe minimum**: $0.50 USD minimum charge means top-ups must be at least $0.50 (recommended $5+).
- **PCI for Node.js clients**: Server-side clients that tokenize cards directly take on SAQ-D PCI scope. Browser-based Stripe.js tokenization is recommended.
- **Single currency per route**: Each route is configured with one currency. Multi-currency support is a future enhancement.

## Disclaimer

This project is not affiliated with, endorsed by, or sponsored by Stripe, Inc. "Stripe" is a registered trademark of Stripe, Inc. This project uses Stripe's publicly available APIs and SDKs as a third-party integration in accordance with Stripe's [Marks Usage Agreement](https://stripe.com/marks/legal). All Stripe-related trademarks, logos, and brand names belong to Stripe, Inc.

This software is provided as-is. The authors make no warranties regarding its suitability for any particular use case, including but not limited to PCI compliance, regulatory compliance, or financial liability. Users are solely responsible for ensuring their use of this software and the Stripe API complies with all applicable laws, regulations, and Stripe's [Terms of Service](https://stripe.com/legal).

## License

Apache License 2.0 — see [LICENSE](LICENSE) for details.

Copyright 2026 Lance Whatley
