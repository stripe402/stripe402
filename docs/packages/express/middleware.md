# Middleware

The `stripe402Middleware` factory function creates Express middleware that gates routes behind HTTP 402 payment requirements.

## `stripe402Middleware(config: Stripe402ServerConfig)`

```ts
import { stripe402Middleware } from '@stripe402/express'

const middleware = stripe402Middleware(config)
app.use(middleware)
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `config` | `Stripe402ServerConfig` | Full middleware configuration. |

### `Stripe402ServerConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripeSecretKey` | `string` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`). Used to create a `StripeService` instance. |
| `stripePublishableKey` | `string` | Yes | Stripe publishable key. Sent to clients in 402 responses for card tokenization. |
| `serverSecret` | `string` | Yes | HMAC key for deriving client IDs from card fingerprints. |
| `store` | `Stripe402Store` | Yes | Persistence store instance (e.g., `RedisStore`, `PostgresStore`). |
| `routes` | `Record<string, RouteConfig>` | Yes | Map of `"METHOD /path"` → route config. |

### `RouteConfig`

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | `number` | Yes | — | Cost per request in units. |
| `currency` | `string` | No | `'usd'` | ISO 4217 currency code. |
| `minTopUp` | `number` | No | `50000` ($5.00) | Minimum top-up in units. |
| `description` | `string` | No | — | Human-readable description. |

### Returns

Express middleware function: `(req: Request, res: Response, next: NextFunction) => Promise<void>`

## Route Matching

Routes are matched by concatenating the HTTP method and path:

```ts
const routeKey = `${req.method} ${req.path}`
```

Examples:
- `GET /api/joke` matches `'GET /api/joke'`
- `POST /api/data` matches `'POST /api/data'`
- `GET /api/health` does **not** match if not in the routes map → passes through

**Important**: The key must exactly match `req.method` (uppercase) and `req.path`. Query strings are not included.

## Code Paths

The middleware follows four paths depending on the request state. See [Payment Flow](../../protocol/payment-flow.md) for the full walkthrough.

### 1. Non-paid route → `next()`

If the route key is not in `config.routes`, the middleware calls `next()` immediately.

### 2. No `payment` header → 402

Sends a `PaymentRequiredResponse` with the route's price, currency, minimum top-up, and the server's Stripe publishable key.

### 3. `clientId` with sufficient credits → deduct + `next()`

Calls `store.deductBalance()`. If successful, sets `payment-response` header and calls `next()`.

### 4. `paymentMethodId` → charge + credit + deduct + `next()`

Full payment flow: validate top-up amount, get card fingerprint, derive client ID, find/create customer, charge card, credit balance, deduct for request, set response header, call `next()`.

## Internal Helper Functions

These functions are not exported — they are internal to the middleware module.

### `send402(res, routeConfig, publishableKey, url, currency, minTopUp, errorCode?)`

Sends a 402 response. Sets both the `payment-required` header (base64 JSON) and the response body (JSON).

```ts
// Response body structure
{
  stripe402Version: 1,
  resource: { url: '/api/weather' },
  accepts: [{
    scheme: 'stripe',
    currency: 'usd',
    amount: 500,
    minTopUp: 50000,
    publishableKey: 'pk_test_...',
    description: 'Weather data',
  }],
  error: undefined,  // or 'insufficient_credits'
}
```

### `sendPaymentError(res, code, message)`

Sends a 402 response with a `PaymentResponse` error body:

```ts
{
  success: false,
  creditsRemaining: 0,
  clientId: '',
  error: message,
  errorCode: code,
}
```

### `setPaymentResponseHeader(res, paymentResponse)`

Sets the `payment-response` header on the response object:

```ts
res.set(HEADERS.PAYMENT_RESPONSE, encodeHeader(paymentResponse))
```

## Error Handling

The middleware catches errors during payment processing:

| Error Type | Error Code | Behavior |
|------------|------------|----------|
| `StripeCardError` (from Stripe SDK) | `card_declined` | Returns Stripe's error message |
| Any other error | `payment_failed` | Returns `err.message` or "Payment processing failed" |
| Invalid base64/JSON in `payment` header | `invalid_payment` | Returns "Malformed payment header" |
| `topUpAmount < minTopUp` | `top_up_below_minimum` | Returns descriptive message with amounts |

## Transaction Logging

If `config.store.recordTransaction` exists, the middleware logs:

- **Top-ups**: `type: 'topup'`, includes `stripePaymentIntentId`
- **Deductions**: `type: 'deduction'`, includes `resource` (the route key, e.g., `'GET /api/joke'`)

Each transaction gets a unique UUID via `randomUUID()`.

## Full Configuration Example

```ts
app.use(
  stripe402Middleware({
    stripeSecretKey: 'sk_test_...',
    stripePublishableKey: 'pk_test_...',
    serverSecret: 'a-strong-random-secret',
    store: new RedisStore(new Redis('redis://localhost:6379')),
    routes: {
      'GET /api/joke': {
        amount: 100,          // 1 cent per request
        minTopUp: 50_000,     // $5.00 minimum top-up
        description: 'Random joke',
      },
      'GET /api/weather': {
        amount: 500,          // 5 cents per request
        currency: 'usd',     // explicit currency (defaults to 'usd')
        minTopUp: 100_000,   // $10.00 minimum top-up
        description: 'Weather data',
      },
      'POST /api/translate': {
        amount: 1000,         // 10 cents per request
        description: 'Text translation',
      },
    },
  })
)
```
