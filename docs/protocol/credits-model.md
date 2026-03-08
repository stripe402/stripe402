# Credits Model

stripe402 uses a prepaid credits system instead of charging per request. This page explains why and how it works.

## Why Credits?

Stripe imposes these constraints on charges:

- **Minimum charge**: $0.50 USD
- **Fixed fee**: ~$0.30 per transaction (plus percentage)

If an API call costs $0.01, charging per request would mean paying $0.30+ in fees on a $0.01 charge — a 3,000% overhead. And charges below $0.50 aren't even possible.

## How It Works

Instead of charging per request, stripe402 charges once for a block of credits:

1. Client requests a resource that costs 100 units ($0.01)
2. Server responds with 402: "This costs 100 units. Minimum top-up is 50,000 units ($5.00)."
3. Client pays $5.00 → receives 50,000 units of credit
4. Server deducts 100 units for this request → 49,900 units remaining
5. Client makes 499 more requests using their client ID → balance reaches 0
6. Server issues a new 402 to prompt a top-up

On a $5.00 top-up, Stripe fees are ~$0.45 (2.9% + $0.30). That's 0.09¢ per request when amortized over 500 requests at $0.01 each — economically viable.

## Default Configuration

| Setting | Value | Description |
|---------|-------|-------------|
| `DEFAULT_MIN_TOP_UP` | 50,000 units ($5.00) | The minimum charge per top-up |
| Per-route `minTopUp` | Configurable | Override per route via `RouteConfig.minTopUp` |

The minimum top-up should always be at least 500 units ($0.50) to satisfy Stripe's minimum charge requirement.

## Balance Storage

Client balances are stored in the persistence layer (`Stripe402Store`):

- **Redis**: Balance stored as a field in a hash at `stripe402:client:{clientId}`
- **PostgreSQL**: Balance stored as an `INTEGER` column in `stripe402_clients`

All balance operations are **atomic** to prevent double-spending under concurrent requests:

- **Redis**: Uses a Lua script that checks and deducts in a single operation
- **PostgreSQL**: Uses `UPDATE ... WHERE balance >= amount RETURNING balance`

## Top-Up Flow

When a client needs to add credits:

1. Client sends `paymentMethodId` and `topUpAmount` in the `payment` header
2. Server validates `topUpAmount >= minTopUp`
3. Server charges the card via Stripe (`PaymentIntent.create` with `confirm: true`)
4. Server calls `store.addBalance(clientId, topUpAmount)` to credit the balance
5. Server deducts the cost of the current request from the new balance
6. Server returns `creditsRemaining` in the `payment-response` header

## Deduction Flow

When a client has existing credits:

1. Client sends `clientId` in the `payment` header
2. Server calls `store.deductBalance(clientId, amount)` atomically
3. If balance >= amount: deduction succeeds, remaining balance is returned
4. If balance < amount: deduction fails (returns `null`), server sends 402 with `error: 'insufficient_credits'`

## Transaction Logging

Both store implementations support optional transaction logging via `store.recordTransaction()`. Each transaction records:

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID generated per transaction |
| `clientId` | `string` | The client's identifier |
| `type` | `'topup' \| 'deduction'` | Whether credits were added or spent |
| `amount` | `number` | Amount in units |
| `stripePaymentIntentId` | `string?` | Stripe PI ID (top-ups only) |
| `resource` | `string?` | Route key, e.g., `'GET /api/joke'` (deductions only) |
| `createdAt` | `Date` | Timestamp |
