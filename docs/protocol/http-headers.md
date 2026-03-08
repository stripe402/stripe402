# HTTP Headers

stripe402 uses three custom HTTP headers to negotiate payments. All header values are JSON objects encoded as base64 strings.

## Header Summary

| Header Name | Direction | HTTP Status | Content |
|-------------|-----------|-------------|---------|
| `payment-required` | Server → Client | 402 | Payment requirements (price, currency, Stripe key) |
| `payment` | Client → Server | Any | Payment payload (PaymentMethod ID or client ID) |
| `payment-response` | Server → Client | 200 | Payment result (client ID, remaining credits) |

The header names are defined as constants in `@stripe402/core`:

```ts
import { HEADERS } from '@stripe402/core'

HEADERS.PAYMENT_REQUIRED  // 'payment-required'
HEADERS.PAYMENT           // 'payment'
HEADERS.PAYMENT_RESPONSE  // 'payment-response'
```

## Encoding

All headers use base64-encoded JSON. This follows the [x402 convention](https://x402.org) and keeps the response body free for application data (e.g., an HTML paywall on 402, or the actual resource on 200).

```ts
import { encodeHeader, decodeHeader } from '@stripe402/core'

// Encoding: object → JSON → base64
const encoded = encodeHeader({ amount: 500, currency: 'usd' })
// => 'eyJhbW91bnQiOjUwMCwiY3VycmVuY3kiOiJ1c2QifQ=='

// Decoding: base64 → JSON → object
const decoded = decodeHeader<{ amount: number; currency: string }>(encoded)
// => { amount: 500, currency: 'usd' }
```

Internally, encoding uses `Buffer.from(JSON.stringify(data)).toString('base64')` and decoding uses `JSON.parse(Buffer.from(header, 'base64').toString('utf-8'))`.

## Header 1: `payment-required`

**Direction**: Server → Client
**When**: Included in every 402 response
**Also**: The same data is sent as the JSON response body

### Schema: `PaymentRequiredResponse`

```ts
interface PaymentRequiredResponse {
  stripe402Version: number         // Protocol version (currently 1)
  resource: ResourceInfo           // The resource being requested
  accepts: PaymentRequirements[]   // Accepted payment options
  error?: string                   // Error code (e.g., 'insufficient_credits')
}
```

### `ResourceInfo`

```ts
interface ResourceInfo {
  url: string            // The requested URL path (e.g., '/api/weather')
  description?: string   // Human-readable description
  mimeType?: string      // Expected response MIME type
}
```

### `PaymentRequirements`

```ts
interface PaymentRequirements {
  scheme: 'stripe'          // Always 'stripe' (payment rail identifier)
  currency: string          // ISO 4217 currency code (e.g., 'usd')
  amount: number            // Cost per request in units (1 unit = 1/10,000 dollar)
  minTopUp: number          // Minimum top-up charge in units
  publishableKey: string    // Stripe publishable key for client-side tokenization
  description?: string      // Human-readable description of the charge
}
```

### Example 402 Response

```
HTTP/1.1 402 Payment Required
payment-required: eyJzdHJpcGU0MDJWZXJzaW9uIjoxLCJyZXNvdXJjZSI6eyJ1cmwiOiIvYXBpL3dlYXRoZXIifSwiYWNjZXB0cyI6W3sic2NoZW1lIjoic3RyaXBlIiwiY3VycmVuY3kiOiJ1c2QiLCJhbW91bnQiOjUwMCwibWluVG9wVXAiOjUwMDAwLCJwdWJsaXNoYWJsZUtleSI6InBrX3Rlc3RfLi4uIiwiZGVzY3JpcHRpb24iOiJXZWF0aGVyIGRhdGEifV19

{
  "stripe402Version": 1,
  "resource": { "url": "/api/weather" },
  "accepts": [{
    "scheme": "stripe",
    "currency": "usd",
    "amount": 500,
    "minTopUp": 50000,
    "publishableKey": "pk_test_...",
    "description": "Weather data"
  }]
}
```

### The `error` Field

When present, the `error` field indicates why the 402 was sent:

| Value | Meaning |
|-------|---------|
| *(absent)* | Initial 402 challenge — client has not attempted payment yet |
| `insufficient_credits` | Client ID was recognized but balance is too low for this request |

## Header 2: `payment`

**Direction**: Client → Server
**When**: Included in retry requests after receiving a 402

### Schema: `PaymentPayload`

```ts
interface PaymentPayload {
  stripe402Version: number       // Protocol version (currently 1)
  paymentMethodId?: string       // Stripe PaymentMethod ID (e.g., 'pm_...')
  clientId?: string              // Client identifier for credit balance lookups
  topUpAmount?: number           // Amount to top up in units (must be >= minTopUp)
}
```

### Usage Patterns

**New payment** (first request or top-up):

```json
{
  "stripe402Version": 1,
  "paymentMethodId": "pm_1234567890",
  "topUpAmount": 50000
}
```

**Using existing credits** (subsequent requests):

```json
{
  "stripe402Version": 1,
  "clientId": "a1b2c3d4e5f6..."
}
```

**Top-up with known client ID** (replenishing credits):

```json
{
  "stripe402Version": 1,
  "paymentMethodId": "pm_1234567890",
  "clientId": "a1b2c3d4e5f6...",
  "topUpAmount": 100000
}
```

## Header 3: `payment-response`

**Direction**: Server → Client
**When**: Included in successful 200 responses after payment or credit deduction

### Schema: `PaymentResponse`

```ts
interface PaymentResponse {
  success: boolean               // Whether the payment/deduction succeeded
  chargeId?: string              // Stripe PaymentIntent ID (only on new payments)
  creditsRemaining: number       // Remaining credit balance in units
  clientId: string               // Client identifier for future requests
  error?: string                 // Error message (when success is false)
  errorCode?: PaymentErrorCode   // Machine-readable error code
}
```

### Example Success Response

```
HTTP/1.1 200 OK
payment-response: eyJzdWNjZXNzIjp0cnVlLCJjaGFyZ2VJZCI6InBpXzEyMzQ1NiIsImNyZWRpdHNSZW1haW5pbmciOjQ5NTAwLCJjbGllbnRJZCI6ImExYjJjM2Q0ZTVmNi4uLiJ9

{
  "temperature": 72,
  "conditions": "Sunny"
}
```

Decoded `payment-response` header:

```json
{
  "success": true,
  "chargeId": "pi_123456",
  "creditsRemaining": 49500,
  "clientId": "a1b2c3d4e5f6..."
}
```

The `clientId` should be stored by the client and included in future requests to use credits without a new payment.
