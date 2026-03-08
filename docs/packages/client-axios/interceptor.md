# Axios Interceptor

The `createStripe402Axios` function wraps an Axios instance with a response interceptor that automatically handles 402 payment flows.

## `createStripe402Axios(instance, config)`

```ts
function createStripe402Axios(
  instance: AxiosInstance,
  config: Stripe402ClientConfig
): AxiosInstance
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `instance` | `AxiosInstance` | An Axios instance (e.g., from `axios.create()`). |
| `config` | `Stripe402ClientConfig` | Client configuration with payment callback. |

### `Stripe402ClientConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onPaymentRequired` | `OnPaymentRequired` | Yes | Callback invoked when a 402 requires payment. |
| `clientId` | `string` | No | Pre-existing client ID to use for credit lookups. |

### `OnPaymentRequired` Callback

```ts
type OnPaymentRequired = (
  requirements: PaymentRequirements
) => Promise<{ paymentMethodId: string; topUpAmount?: number } | null>
```

The callback receives the `PaymentRequirements` from the 402 response (price, currency, min top-up, Stripe publishable key) and should return:

| Return Value | Behavior |
|-------------|----------|
| `{ paymentMethodId: 'pm_...', topUpAmount?: number }` | Retry with this payment method. `topUpAmount` defaults to `minTopUp`. |
| `null` | User declined to pay. The original 402 error is re-thrown. |

### Returns

The same `AxiosInstance` with the interceptor installed. The instance is modified in-place and also returned for chaining.

## How It Works

The interceptor installs two handlers:

### Success Handler

On any successful response (non-402), checks for a `payment-response` header and extracts the `clientId` for future requests:

```ts
const paymentResponseHeader = response.headers[HEADERS.PAYMENT_RESPONSE]
if (paymentResponseHeader) {
  const paymentResponse = decodeHeader<PaymentResponse>(paymentResponseHeader)
  if (paymentResponse.clientId) {
    storedClientId = paymentResponse.clientId  // cached in closure
  }
}
```

### Error Handler (402 Flow)

When a 402 response is received:

1. **Prevent infinite loops**: Checks for a `_stripe402Retry` flag on the request config. If set, the error is re-thrown (prevents looping).

2. **Decode 402 requirements**: Reads the `payment-required` header and decodes the `PaymentRequiredResponse`.

3. **Try existing credits**: If `storedClientId` exists and the error is NOT `insufficient_credits`, retries with just the client ID:
   ```ts
   payload = { stripe402Version: 1, clientId: storedClientId }
   ```

4. **Request payment**: If no stored client ID or credits are insufficient, calls `config.onPaymentRequired(requirements)`.

5. **Retry with payment**: If the callback returns payment info, retries with:
   ```ts
   payload = {
     stripe402Version: 1,
     paymentMethodId: paymentInfo.paymentMethodId,
     clientId: storedClientId ?? undefined,
     topUpAmount: paymentInfo.topUpAmount,
   }
   ```

6. **User declined**: If the callback returns `null`, the original 402 error is re-thrown.

## Client ID Caching

The client ID is stored in a closure variable (`storedClientId`). This means:

- It persists across requests made with the same Axios instance
- It is lost if the Axios instance is garbage collected
- It is initialized from `config.clientId` if provided
- It is updated whenever a `payment-response` header contains a `clientId`

## Retry Prevention

A `_stripe402Retry` flag is added to the request config before retrying. This prevents infinite loops where:
1. Request returns 402
2. Retry with payment also returns 402
3. Would retry again indefinitely

The flag ensures the interceptor only attempts one retry per original request.

## `getStoredClientId(instance)`

```ts
function getStoredClientId(instance: AxiosInstance): string | null
```

Currently returns `null`. The stored client ID is in the interceptor's closure and not directly accessible externally. To track client IDs across sessions, extract them from the `payment-response` header in the `onPaymentRequired` callback or from successful responses.

## Complete Example

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(
  axios.create({ baseURL: 'https://api.example.com' }),
  {
    // Optional: restore a previously saved client ID
    clientId: savedClientId ?? undefined,

    onPaymentRequired: async (requirements) => {
      console.log(`Payment required: ${requirements.amount} units`)
      console.log(`Min top-up: ${requirements.minTopUp} units`)
      console.log(`Currency: ${requirements.currency}`)

      // In a browser: use Stripe.js to tokenize a card
      // In a server: use a stored PaymentMethod ID
      const paymentMethodId = await getPaymentMethod(requirements.publishableKey)

      if (!paymentMethodId) return null // User cancelled

      return {
        paymentMethodId,
        topUpAmount: requirements.minTopUp,
      }
    },
  }
)

// First request: 402 → onPaymentRequired → retry with payment → 200
const res1 = await client.get('/api/weather')

// Subsequent requests: payment header with clientId → 200 (uses credits)
const res2 = await client.get('/api/weather')
const res3 = await client.get('/api/weather')
```
