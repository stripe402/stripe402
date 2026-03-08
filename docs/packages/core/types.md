# Types & Interfaces

All TypeScript types and interfaces defined in `@stripe402/core`. These are the data structures that flow through the stripe402 protocol.

## Protocol Messages

### `PaymentRequiredResponse`

Server → Client. Included in the `payment-required` header and body of every 402 response.

```ts
interface PaymentRequiredResponse {
  stripe402Version: number
  resource: ResourceInfo
  accepts: PaymentRequirements[]
  error?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripe402Version` | `number` | Yes | Protocol version. Currently `1`. |
| `resource` | `ResourceInfo` | Yes | Describes the resource being requested. |
| `accepts` | `PaymentRequirements[]` | Yes | Array of accepted payment options. Currently always contains one element with `scheme: 'stripe'`. |
| `error` | `string` | No | Error code indicating why the 402 was sent. Values: `undefined` (initial challenge), `'insufficient_credits'` (balance too low). |

### `ResourceInfo`

Describes the resource being requested.

```ts
interface ResourceInfo {
  url: string
  description?: string
  mimeType?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `url` | `string` | Yes | The requested URL path (e.g., `'/api/weather'`). |
| `description` | `string` | No | Human-readable description of the resource. |
| `mimeType` | `string` | No | Expected MIME type of the response. |

### `PaymentRequirements`

A single accepted payment option within a 402 response.

```ts
interface PaymentRequirements {
  scheme: 'stripe'
  currency: string
  amount: number
  minTopUp: number
  publishableKey: string
  description?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `scheme` | `'stripe'` | Yes | Payment rail identifier. Always `'stripe'`. |
| `currency` | `string` | Yes | ISO 4217 currency code (e.g., `'usd'`). |
| `amount` | `number` | Yes | Cost of this request in units (1 unit = 1/10,000 of a dollar). Example: `500` = $0.05. |
| `minTopUp` | `number` | Yes | Minimum top-up charge in units. Example: `50000` = $5.00. |
| `publishableKey` | `string` | Yes | Stripe publishable key for client-side card tokenization via Stripe.js. |
| `description` | `string` | No | Human-readable description of what the payment is for. |

### `PaymentPayload`

Client → Server. Included in the `payment` header of retry requests.

```ts
interface PaymentPayload {
  stripe402Version: number
  paymentMethodId?: string
  clientId?: string
  topUpAmount?: number
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripe402Version` | `number` | Yes | Protocol version. Must match server's version. |
| `paymentMethodId` | `string` | No | Stripe PaymentMethod ID from client-side tokenization (e.g., `'pm_...'`). Required for new payments. |
| `clientId` | `string` | No | Client identifier for credit balance lookups. Used for subsequent requests after initial payment. |
| `topUpAmount` | `number` | No | Amount to top up in units. Must be >= `minTopUp`. Defaults to `minTopUp` if not specified. |

### `PaymentResponse`

Server → Client. Included in the `payment-response` header of successful responses.

```ts
interface PaymentResponse {
  success: boolean
  chargeId?: string
  creditsRemaining: number
  clientId: string
  error?: string
  errorCode?: PaymentErrorCode
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | `boolean` | Yes | Whether the payment or deduction succeeded. |
| `chargeId` | `string` | No | Stripe PaymentIntent ID. Only present on new payments (not credit deductions). |
| `creditsRemaining` | `number` | Yes | Remaining credit balance in units after this request. |
| `clientId` | `string` | Yes | Client identifier for future requests. Store this and include in subsequent requests. |
| `error` | `string` | No | Human-readable error message (when `success` is `false`). |
| `errorCode` | `PaymentErrorCode` | No | Machine-readable error code (when `success` is `false`). |

## Persistence Types

### `ClientRecord`

A client record stored in the persistence layer.

```ts
interface ClientRecord {
  clientId: string
  stripeCustomerId: string
  balance: number
  currency: string
  createdAt: Date
  updatedAt: Date
}
```

| Field | Type | Description |
|-------|------|-------------|
| `clientId` | `string` | HMAC-derived client identifier (64-char hex string). |
| `stripeCustomerId` | `string` | Stripe Customer ID (e.g., `'cus_...'`). |
| `balance` | `number` | Current credit balance in units. |
| `currency` | `string` | ISO 4217 currency code (e.g., `'usd'`). |
| `createdAt` | `Date` | When the client record was created. |
| `updatedAt` | `Date` | When the client record was last modified. |

### `TransactionRecord`

A transaction log entry for audit purposes.

```ts
interface TransactionRecord {
  id: string
  clientId: string
  type: 'topup' | 'deduction'
  amount: number
  stripePaymentIntentId?: string
  resource?: string
  createdAt: Date
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique transaction ID (UUID). |
| `clientId` | `string` | The client's identifier. |
| `type` | `'topup' \| 'deduction'` | Whether credits were added or spent. |
| `amount` | `number` | Amount in units. |
| `stripePaymentIntentId` | `string?` | Stripe PaymentIntent ID (top-ups only). |
| `resource` | `string?` | Route key, e.g., `'GET /api/joke'` (deductions only). |
| `createdAt` | `Date` | When the transaction occurred. |

### `Stripe402Store`

Persistence store interface. Implementations must ensure atomic balance operations.

```ts
interface Stripe402Store {
  getClient(clientId: string): Promise<ClientRecord | null>
  createClient(record: ClientRecord): Promise<void>
  deductBalance(clientId: string, amount: number): Promise<number | null>
  addBalance(clientId: string, amount: number): Promise<number>
  recordTransaction?(transaction: TransactionRecord): Promise<void>
}
```

| Method | Returns | Description |
|--------|---------|-------------|
| `getClient(clientId)` | `ClientRecord \| null` | Get a client record by ID, or `null` if not found. |
| `createClient(record)` | `void` | Create a new client record. |
| `deductBalance(clientId, amount)` | `number \| null` | Atomically deduct from balance. Returns new balance, or `null` if insufficient funds. **Must be atomic.** |
| `addBalance(clientId, amount)` | `number` | Add to balance. Returns the new balance. |
| `recordTransaction(transaction)` | `void` | Record a transaction for audit logging. **Optional** — stores that don't support this can omit the method. |

See [Store Interface](../server/store-interface.md) for implementation details.

## Server Configuration

### `RouteConfig`

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
| `amount` | `number` | Yes | — | Cost per request in units (1 unit = 1/10,000 of a dollar). |
| `currency` | `string` | No | `'usd'` | ISO 4217 currency code. |
| `minTopUp` | `number` | No | `50000` ($5.00) | Minimum top-up amount in units. |
| `description` | `string` | No | — | Human-readable description shown in 402 responses and Stripe charge descriptions. |

### `Stripe402ServerConfig`

Full middleware configuration.

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
| `stripeSecretKey` | `string` | Yes | Stripe secret key (`sk_test_...` or `sk_live_...`). |
| `stripePublishableKey` | `string` | Yes | Stripe publishable key (`pk_test_...` or `pk_live_...`). Sent to clients in 402 responses. |
| `serverSecret` | `string` | Yes | HMAC key for deriving client IDs from card fingerprints. |
| `store` | `Stripe402Store` | Yes | Persistence store instance (e.g., `RedisStore`, `PostgresStore`). |
| `routes` | `Record<string, RouteConfig>` | Yes | Map of `"METHOD /path"` to route configuration. Example key: `'GET /api/weather'`. |

## Client Configuration

### `OnPaymentRequired`

Callback invoked when a 402 response requires payment.

```ts
type OnPaymentRequired = (
  requirements: PaymentRequirements
) => Promise<{ paymentMethodId: string; topUpAmount?: number } | null>
```

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `requirements` | `PaymentRequirements` | The payment requirements from the 402 response (price, currency, minimum top-up, Stripe publishable key). |

**Returns**: `Promise<{ paymentMethodId: string; topUpAmount?: number } | null>`

| Return Value | Description |
|-------------|-------------|
| `{ paymentMethodId, topUpAmount? }` | Payment details. `topUpAmount` defaults to `requirements.minTopUp` if omitted. |
| `null` | User declined to pay. The original 402 error is re-thrown (Axios) or the 402 response is returned (Fetch). |

### `Stripe402ClientConfig`

Configuration for client wrappers.

```ts
interface Stripe402ClientConfig {
  onPaymentRequired: OnPaymentRequired
  clientId?: string
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onPaymentRequired` | `OnPaymentRequired` | Yes | Callback to handle payment when a 402 is received. |
| `clientId` | `string` | No | Pre-existing client ID to include in requests. If provided, the client will first attempt to use credits before calling `onPaymentRequired`. |

## Error Types

### `PaymentErrorCode`

Union type of all possible error codes.

```ts
type PaymentErrorCode =
  | 'payment_required'
  | 'card_declined'
  | 'insufficient_credits'
  | 'payment_failed'
  | 'invalid_payment'
  | 'top_up_below_minimum'
```

See [Error Codes](../../protocol/error-codes.md) for detailed descriptions of each code.
