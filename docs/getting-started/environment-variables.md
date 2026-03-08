# Environment Variables

All configuration for the example application and typical stripe402 deployments.

## Server Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | **Yes** | — | Stripe secret key. Get from [Stripe Dashboard > API Keys](https://dashboard.stripe.com/test/apikeys). Use `sk_test_...` for testing, `sk_live_...` for production. |
| `STRIPE_PUBLISHABLE_KEY` | **Yes** | — | Stripe publishable key. Get from the same dashboard page. Use `pk_test_...` for testing, `pk_live_...` for production. Sent to clients in 402 responses so they can tokenize cards via Stripe.js. |
| `SERVER_SECRET` | No | `change-me-in-production` | Secret key used for HMAC-SHA256 client ID derivation. Must be a strong random string in production. Same card + same secret = same client ID. Changing this invalidates all existing client IDs and their credit balances. |
| `MIN_TOP_UP` | No | `50000` (= $5.00) | Default minimum top-up amount in **units** (1 unit = 1/10,000 of a dollar). Can be overridden per route via `RouteConfig.minTopUp`. Must be at least `500` ($0.50) due to Stripe's minimum charge. |
| `PORT` | No | `3000` | HTTP server port. |

## Store Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL. Used by `RedisStore`. In Docker Compose, defaults to `redis://redis:6379`. Supports standard Redis URL format: `redis://[username:password@]host[:port][/db]`. |
| `DATABASE_URL` | No | — | PostgreSQL connection URL. Used by `PostgresStore`. Format: `postgresql://user:password@host:port/dbname`. Not used by default — the example app uses Redis. |

## Client Demo Variables

These are only used by the example client demo scripts (`demo:axios`, `demo:fetch`):

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `TEST_PAYMENT_METHOD_ID` | No | — | A Stripe test PaymentMethod ID for running client demos without real cards. Create one with: `cd apps/example && pnpm create-pm` or via Stripe CLI: `stripe paymentmethods create --type=card -d card[token]=tok_visa`. See [Creating Payment Methods](../guides/creating-payment-methods.md). |
| `API_URL` | No | `http://localhost:3000` | Base URL for the API server that client demos connect to. |

## Docker Compose Variables

These variables configure the Docker Compose setup in `docker-compose.yml`:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Host port for the example server container. |
| `WEBSITE_PORT` | `4000` | Host port for the marketing website container. |

The Docker Compose file also hardcodes these values for the PostgreSQL container:

| Setting | Value |
|---------|-------|
| `POSTGRES_USER` | `stripe402` |
| `POSTGRES_PASSWORD` | `stripe402` |
| `POSTGRES_DB` | `stripe402` |
| PostgreSQL host port | `5433` (maps to container port `5432`) |

## Units Reference

Since several variables use **units**, here's a quick reference:

| Units | Dollars | Cents |
|-------|---------|-------|
| 1 | $0.0001 | 0.01¢ |
| 100 | $0.01 | 1¢ |
| 500 | $0.05 | 5¢ |
| 10,000 | $1.00 | 100¢ |
| 50,000 | $5.00 | 500¢ |

See [Pricing Units](../protocol/pricing-units.md) for full details.
