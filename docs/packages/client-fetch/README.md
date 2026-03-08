# @stripe402/client-fetch

A wrapper around the native `fetch` API that automatically handles stripe402 payment flows. When a paid endpoint returns 402, the wrapper handles payment negotiation and retries the request transparently.

## Installation

```bash
pnpm add @stripe402/client-fetch
```

No peer dependencies — uses the native `fetch` API (available in Node.js 18+).

## Exports

```ts
export { createStripe402Fetch } from './wrapper'
```

## Quick Example

```ts
import { createStripe402Fetch } from '@stripe402/client-fetch'

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    return {
      paymentMethodId: 'pm_...',
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Automatically handles 402 → payment → retry
const response = await fetchWithPayment('https://api.example.com/api/weather')
const data = await response.json()
console.log(data) // => { temperature: 72, conditions: 'Sunny' }
```

## Sub-Pages

- [Fetch Wrapper](wrapper.md) — `createStripe402Fetch()` details, retry logic, `baseFetch` parameter
