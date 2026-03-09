# Client Integration Guide

How to integrate stripe402 client libraries to automatically handle 402 payment flows.

## Choosing a Client

| Client | Best For | Peer Deps |
|--------|----------|-----------|
| `@stripe402/client-axios` | Existing Axios codebases, Node.js servers | `axios >= 1.0.0` |
| `@stripe402/client-fetch` | Browser apps, Deno, Node.js 18+, minimal deps | None |

Both clients follow the same pattern:
1. Wrap your HTTP client with a payment handler
2. Provide an `onPaymentRequired` callback
3. Make requests normally — 402 handling is transparent

## Axios Integration

### Installation

```bash
pnpm add @stripe402/client-axios axios
```

### Setup

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(
  axios.create({ baseURL: 'https://api.example.com' }),
  {
    // Optional: restore a saved client ID from a previous session
    clientId: loadSavedClientId() ?? undefined,

    onPaymentRequired: async (requirements) => {
      // requirements contains: amount, currency, minTopUp, publishableKey, description
      console.log(`Payment required: ${requirements.amount} units`)

      // Get a PaymentMethod ID (see "Getting a PaymentMethod" below)
      const paymentMethodId = await getPaymentMethod(requirements)
      if (!paymentMethodId) return null // User declined

      return {
        paymentMethodId,
        topUpAmount: requirements.minTopUp, // Or let the user choose
      }
    },
  }
)

// Use like a normal Axios instance
const response = await client.get('/api/weather')
console.log(response.data)
```

### How It Works

1. `client.get('/api/weather')` → server returns 402
2. Interceptor decodes the 402 response
3. If a cached `clientId` exists, retries with just the client ID (uses credits)
4. If credits are insufficient, calls `onPaymentRequired`
5. Retries with the payment header
6. Returns the 200 response as if the 402 never happened

## Fetch Integration

### Installation

```bash
pnpm add @stripe402/client-fetch
```

### Setup

```ts
import { createStripe402Fetch } from '@stripe402/client-fetch'

const fetchWithPayment = createStripe402Fetch({
  clientId: loadSavedClientId() ?? undefined,

  onPaymentRequired: async (requirements) => {
    const paymentMethodId = await getPaymentMethod(requirements)
    if (!paymentMethodId) return null

    return {
      paymentMethodId,
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Use like normal fetch
const response = await fetchWithPayment('https://api.example.com/api/weather')
const data = await response.json()
```

### Key Difference from Axios

If the user declines to pay (callback returns `null`):
- **Axios**: Throws the original 402 error
- **Fetch**: Returns the 402 `Response` object (you check `response.ok`)

## Getting a PaymentMethod ID

The `onPaymentRequired` callback must return a Stripe PaymentMethod ID (`pm_...`). **Clients do not need a Stripe account** — the 402 response includes the server's publishable key (`requirements.publishableKey`), which is all that's needed to tokenize a card.

> For all options, see [Creating Payment Methods](creating-payment-methods.md).

### Headless / Node.js Client

Use the Stripe SDK with the publishable key from the 402 response and your card details:

```ts
import Stripe from 'stripe'

const MY_CARD = {
  number: '4242424242424242',  // Test card
  exp_month: 12,
  exp_year: 2034,
  cvc: '123',
}

const onPaymentRequired = async (requirements) => {
  // Use the PUBLISHABLE key from the 402 response — no Stripe account needed
  const stripe = new Stripe(requirements.publishableKey)

  // Card details go directly to Stripe, not to the API server
  const pm = await stripe.paymentMethods.create({
    type: 'card',
    card: MY_CARD,
  })

  return {
    paymentMethodId: pm.id,
    topUpAmount: requirements.minTopUp,
  }
}
```

### Browser (Stripe.js)

For web apps where users enter their card in a form:

```ts
import { loadStripe } from '@stripe/stripe-js'

const onPaymentRequired = async (requirements) => {
  // Use the publishable key from the 402 response
  const stripe = await loadStripe(requirements.publishableKey)

  // cardElement is a Stripe Elements card input mounted on your page
  const { paymentMethod, error } = await stripe.createPaymentMethod({
    type: 'card',
    card: cardElement,
  })

  if (error || !paymentMethod) return null

  return {
    paymentMethodId: paymentMethod.id,
    topUpAmount: requirements.minTopUp,
  }
}
```

See [Creating Payment Methods — Browser](creating-payment-methods.md#method-2-browser-client-stripejs) for a complete example with Stripe Elements setup.

### Complete Agent Example

A self-contained script — the agent just needs card details, nothing else:

```ts
import Stripe from 'stripe'
import { createStripe402Fetch } from '@stripe402/client-fetch'

const MY_CARD = {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2034,
  cvc: '123',
}

const agentFetch = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    // publishableKey comes from the 402 response — no Stripe account needed
    const stripe = new Stripe(requirements.publishableKey)
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: MY_CARD,
    })
    return { paymentMethodId: pm.id, topUpAmount: requirements.minTopUp }
  },
})

// Payment is fully automatic — just fetch
const response = await agentFetch('https://api.example.com/api/weather')
const data = await response.json()
console.log(data)
```

## Persisting Client IDs

After the first payment, the server returns a `clientId` in the `payment-response` header. The client libraries cache this automatically for the session. To persist across sessions:

```ts
// Save the client ID from response headers
const response = await client.get('/api/weather')
const paymentResponseHeader = response.headers['payment-response']
if (paymentResponseHeader) {
  const { clientId } = decodeHeader(paymentResponseHeader)
  saveClientId(clientId) // e.g., localStorage, database, file
}

// Restore on next session
const client = createStripe402Axios(axios.create(), {
  clientId: loadSavedClientId(),
  onPaymentRequired: ...
})
```

## Custom Top-Up Amounts

The `topUpAmount` field lets the client choose how much to top up (must be >= `minTopUp`):

```ts
const onPaymentRequired = async (requirements) => {
  // Let the user choose their top-up amount
  const topUpAmount = await promptUserForAmount(requirements.minTopUp)

  return {
    paymentMethodId: 'pm_...',
    topUpAmount, // e.g., 100_000 for $10.00
  }
}
```
