# stripe402 Example

A working example server with two paid endpoints and client demo scripts.

## Prerequisites

- Node.js 18+
- pnpm
- Redis running locally (or via Docker)
- A [Stripe test account](https://dashboard.stripe.com/test/apikeys) (for the **server** only)

## Setup

### 1. Install dependencies (from repo root)

```bash
pnpm install
pnpm build
```

### 2. Start Redis

```bash
# Option A: Docker
docker compose up redis -d

# Option B: Local Redis (default port 6379)
redis-server
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your Stripe **test** keys:

```
STRIPE_SECRET_KEY=sk_test_...        # Server needs this to charge cards
STRIPE_PUBLISHABLE_KEY=pk_test_...   # Included in 402 responses for clients
SERVER_SECRET=any-random-string      # Used for HMAC client identity
```

### 4. Create a test PaymentMethod

This simulates what a real client does — tokenize a card using the server's publishable key:

```bash
pnpm create-pm
```

Output:

```
PaymentMethod created successfully!

  ID:       pm_1RFxyz...
  Brand:    visa
  Last 4:   4242
  Expires:  12/2034

Add to your .env file:
  TEST_PAYMENT_METHOD_ID=pm_1RFxyz...
```

Copy the `TEST_PAYMENT_METHOD_ID=pm_...` line into your `.env` file.

You can also specify a different test card:

```bash
pnpm create-pm 5555555555554444            # Mastercard
pnpm create-pm 4242424242424242 12 2034 123  # Custom: number exp_month exp_year cvc
```

## Running

### Start the server

```bash
pnpm dev
```

Output:

```
stripe402 example server running on http://localhost:3000
  Free:  GET /api/health
  Paid:  GET /api/joke    (1¢ per request, $5.00 min top-up)
  Paid:  GET /api/weather (5¢ per request, $5.00 min top-up)
```

### Run a client demo

With the server running, open a second terminal:

```bash
# Axios client
pnpm demo:axios

# Fetch client
pnpm demo:fetch
```

Both demos will:

1. Hit the free `/api/health` endpoint (no payment)
2. Hit the paid `/api/joke` endpoint, which triggers the 402 flow:
   - Server responds with 402 + pricing info
   - Client sends `TEST_PAYMENT_METHOD_ID` as payment
   - Server charges the card, creates a credit balance
   - Server returns the joke

### Test with curl

```bash
# Free endpoint
curl http://localhost:3000/api/health

# Paid endpoint — returns 402 with pricing details
curl -i http://localhost:3000/api/joke
```

The 402 response includes a base64-encoded `payment-required` header containing the price, minimum top-up, and the server's publishable key.

## Endpoints

| Endpoint | Cost | Description |
|----------|------|-------------|
| `GET /api/health` | Free | Health check |
| `GET /api/joke` | 100 units ($0.01) | Random programming joke |
| `GET /api/weather` | 500 units ($0.05) | Mock weather data |

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `STRIPE_SECRET_KEY` | Yes | — | Stripe secret key (`sk_test_...`) |
| `STRIPE_PUBLISHABLE_KEY` | Yes | — | Stripe publishable key (`pk_test_...`) |
| `SERVER_SECRET` | No | `change-me-in-production` | Secret for HMAC client identity |
| `MIN_TOP_UP` | No | `50000` | Minimum top-up in units ($5.00) |
| `PORT` | No | `3000` | Server port |
| `REDIS_URL` | No | `redis://localhost:6379` | Redis connection URL |
| `DATABASE_URL` | No | — | PostgreSQL URL (uses Redis by default) |
| `TEST_PAYMENT_METHOD_ID` | No | — | Pre-created `pm_...` for client demos |
| `API_URL` | No | `http://localhost:3000` | Server URL for client demos |
