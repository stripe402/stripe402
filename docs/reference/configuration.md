# Configuration Reference

Complete reference for all configuration types in stripe402.

## `Stripe402ServerConfig`

The main configuration object passed to `stripe402Middleware()`.

```ts
interface Stripe402ServerConfig {
  stripeSecretKey: string
  stripePublishableKey: string
  serverSecret: string
  store: Stripe402Store
  routes: Record<string, RouteConfig>
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripeSecretKey` | `string` | Yes | Stripe secret key. Use `sk_test_...` for test mode, `sk_live_...` for production. Used to create `StripeService` for charging cards, retrieving fingerprints, and managing customers. |
| `stripePublishableKey` | `string` | Yes | Stripe publishable key. Use `pk_test_...` or `pk_live_...`. Included in 402 responses so clients can tokenize cards via Stripe.js. |
| `serverSecret` | `string` | Yes | HMAC key for deriving client IDs from card fingerprints. Must be a strong random string in production. Changing this invalidates all existing client IDs and their balances. |
| `store` | `Stripe402Store` | Yes | Persistence store instance. Built-in options: `RedisStore`, `PostgresStore`. Can be any object implementing the `Stripe402Store` interface. |
| `routes` | `Record<string, RouteConfig>` | Yes | Map of route keys to their payment configuration. Keys must be in the format `"METHOD /path"` (e.g., `"GET /api/weather"`). |

### Route Key Format

Route keys are matched against `${req.method} ${req.path}`:

```ts
routes: {
  'GET /api/joke': { ... },       // Matches GET requests to /api/joke
  'POST /api/translate': { ... },  // Matches POST requests to /api/translate
  'GET /api/weather': { ... },     // Matches GET requests to /api/weather
}
```

- Method is uppercase (`GET`, `POST`, `PUT`, `DELETE`, etc.)
- Path does not include query strings
- No wildcard or pattern matching — exact match only

---

## `RouteConfig`

Configuration for a single paid route.

```ts
interface RouteConfig {
  amount: number
  currency?: string
  minTopUp?: number
  description?: string
}
```

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `amount` | `number` | Yes | — | Cost per request in **units** (1 unit = 1/10,000 of a dollar). Examples: `100` = $0.01, `500` = $0.05, `10000` = $1.00. |
| `currency` | `string` | No | `'usd'` | ISO 4217 currency code. Used in the 402 response and Stripe PaymentIntent. |
| `minTopUp` | `number` | No | `50000` ($5.00) | Minimum top-up charge in units. Must be at least `500` ($0.50) due to Stripe's minimum charge. Clients can top up more than this, but not less. |
| `description` | `string` | No | — | Human-readable description. Included in the 402 response and in the Stripe charge description (`"stripe402 top-up for {description}"`). |

---

## `Stripe402ClientConfig`

Configuration for client wrappers (`createStripe402Axios`, `createStripe402Fetch`).

```ts
interface Stripe402ClientConfig {
  onPaymentRequired: OnPaymentRequired
  clientId?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onPaymentRequired` | `OnPaymentRequired` | Yes | Callback invoked when a 402 response requires payment. See below. |
| `clientId` | `string` | No | Pre-existing client ID to include in requests. If provided, the client will first attempt to use credits before calling `onPaymentRequired`. Useful for restoring a session. |

---

## `OnPaymentRequired`

Callback type for handling 402 responses.

```ts
type OnPaymentRequired = (
  requirements: PaymentRequirements
) => Promise<{ paymentMethodId: string; topUpAmount?: number } | null>
```

### Input: `PaymentRequirements`

The callback receives the payment requirements from the 402 response:

| Field | Type | Description |
|-------|------|-------------|
| `scheme` | `'stripe'` | Always `'stripe'`. |
| `currency` | `string` | Currency code (e.g., `'usd'`). |
| `amount` | `number` | Cost of the request in units. |
| `minTopUp` | `number` | Minimum top-up in units. |
| `publishableKey` | `string` | Stripe publishable key for card tokenization. |
| `description` | `string?` | Description of the charge. |

### Output

| Return Value | Description |
|-------------|-------------|
| `{ paymentMethodId: string, topUpAmount?: number }` | Proceed with payment. `paymentMethodId` is a Stripe PaymentMethod ID (`pm_...`). `topUpAmount` is the amount to top up in units (defaults to `minTopUp` on the server). |
| `null` | Decline to pay. Axios throws the 402 error; Fetch returns the 402 response. |

---

## `Stripe402Store`

The persistence interface. See [Store Interface](../packages/server/store-interface.md) for full details.

```ts
interface Stripe402Store {
  getClient(clientId: string): Promise<ClientRecord | null>
  createClient(record: ClientRecord): Promise<void>
  deductBalance(clientId: string, amount: number): Promise<number | null>
  addBalance(clientId: string, amount: number): Promise<number>
  recordTransaction?(transaction: TransactionRecord): Promise<void>
}
```

Built-in implementations:
- [`RedisStore`](../packages/server/redis-store.md) — `new RedisStore(redisClient)`
- [`PostgresStore`](../packages/server/postgres-store.md) — `new PostgresStore(pgPool)`
