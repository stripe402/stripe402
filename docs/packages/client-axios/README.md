# @stripe402/client-axios

Axios interceptor that automatically handles stripe402 payment flows. When a paid endpoint returns 402, the interceptor handles payment negotiation and retries the request transparently.

## Installation

```bash
pnpm add @stripe402/client-axios axios
```

### Peer Dependencies

| Peer Dependency | Version |
|-----------------|---------|
| `axios` | >= 1.0.0 |

## Exports

```ts
export { createStripe402Axios } from './interceptor'
```

## Quick Example

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(axios.create(), {
  onPaymentRequired: async (requirements) => {
    // Use Stripe.js to tokenize a card, or return a stored PaymentMethod
    return {
      paymentMethodId: 'pm_...',
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Automatically handles 402 → payment → retry
const response = await client.get('https://api.example.com/api/weather')
console.log(response.data) // => { temperature: 72, conditions: 'Sunny' }
```

## Sub-Pages

- [Axios Interceptor](interceptor.md) — `createStripe402Axios()` details, retry logic, client ID caching
