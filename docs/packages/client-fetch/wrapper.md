# Fetch Wrapper

The `createStripe402Fetch` function wraps the native `fetch` API to automatically handle 402 payment flows.

## `createStripe402Fetch(config, baseFetch?)`

```ts
function createStripe402Fetch(
  config: Stripe402ClientConfig,
  baseFetch: typeof fetch = globalThis.fetch
): typeof fetch
```

### Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `config` | `Stripe402ClientConfig` | Yes | — | Client configuration with payment callback. |
| `baseFetch` | `typeof fetch` | No | `globalThis.fetch` | Base fetch function to wrap. Useful for testing or chaining with other wrappers. |

### `Stripe402ClientConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `onPaymentRequired` | `OnPaymentRequired` | Yes | Callback invoked when a 402 requires payment. |
| `clientId` | `string` | No | Pre-existing client ID for credit lookups. |

### `OnPaymentRequired` Callback

```ts
type OnPaymentRequired = (
  requirements: PaymentRequirements
) => Promise<{ paymentMethodId: string; topUpAmount?: number } | null>
```

| Return Value | Behavior |
|-------------|----------|
| `{ paymentMethodId, topUpAmount? }` | Retry with payment. `topUpAmount` defaults to `minTopUp` on the server side. |
| `null` | User declined. The original 402 `Response` is returned (not thrown). |

### Returns

A function with the same signature as `fetch`:

```ts
(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
```

## How It Works

### Non-402 Responses

For any response that is not a 402:
1. Checks for a `payment-response` header
2. If present, extracts and caches the `clientId` for future requests
3. Returns the response as-is

### 402 Flow

When a 402 response is received:

1. **Check for retry loop**: If the request already has a `payment` header in `init.headers`, returns the 402 response (prevents infinite loops).

2. **Decode requirements**: Reads the `payment-required` header and decodes the `PaymentRequiredResponse`.

3. **Try existing credits**: If `storedClientId` exists and the error is NOT `insufficient_credits`:
   - Retries with `{ stripe402Version: 1, clientId: storedClientId }`
   - If the retry succeeds (non-402), extracts the client ID and returns the response
   - If the retry also returns 402 (insufficient credits), falls through to step 4

4. **Request payment**: Calls `config.onPaymentRequired(requirements)`.

5. **User declined**: If the callback returns `null`, returns the original 402 response.

6. **Retry with payment**: Retries with the full payment payload:
   ```ts
   {
     stripe402Version: 1,
     paymentMethodId: paymentInfo.paymentMethodId,
     clientId: storedClientId ?? undefined,
     topUpAmount: paymentInfo.topUpAmount,
   }
   ```

7. **Extract client ID**: From the final response's `payment-response` header.

## Differences from the Axios Interceptor

| Aspect | Axios (`createStripe402Axios`) | Fetch (`createStripe402Fetch`) |
|--------|-------------------------------|-------------------------------|
| **Retry prevention** | Uses `_stripe402Retry` flag on config object | Checks if `payment` header already exists |
| **User declined** | Throws the original error | Returns the original 402 Response |
| **Credit retry failure** | Not handled (single retry attempt) | Falls through to payment if credit retry returns 402 |
| **Instance modification** | Modifies instance in-place | Returns a new function (wraps, doesn't modify) |
| **baseFetch parameter** | N/A | Allows custom base fetch (useful for testing) |

## Client ID Caching

Like the Axios interceptor, the client ID is stored in a closure:

- Initialized from `config.clientId` if provided
- Updated from `payment-response` headers on successful responses
- Persists across calls to the returned fetch function
- Lost when the function is garbage collected

## The `baseFetch` Parameter

The second parameter lets you provide a custom fetch implementation:

```ts
// For testing with a mock
const mockFetch = vi.fn()
const fetchWithPayment = createStripe402Fetch(config, mockFetch)

// For chaining with other wrappers
const fetchWithAuth = createAuthFetch()
const fetchWithPayment = createStripe402Fetch(config, fetchWithAuth)
```

Defaults to `globalThis.fetch` when not specified.

## Complete Example

```ts
import { createStripe402Fetch } from '@stripe402/client-fetch'

const fetchWithPayment = createStripe402Fetch({
  clientId: savedClientId ?? undefined,

  onPaymentRequired: async (requirements) => {
    console.log(`Cost: ${requirements.amount} units (${requirements.currency})`)

    const paymentMethodId = await getPaymentMethod(requirements.publishableKey)
    if (!paymentMethodId) return null

    return {
      paymentMethodId,
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Works exactly like fetch
const response = await fetchWithPayment('https://api.example.com/api/weather', {
  headers: { 'Accept': 'application/json' },
})

if (response.ok) {
  const data = await response.json()
  console.log(data)
} else {
  // 402 returned if user declined to pay
  console.log('Payment required or declined')
}
```
