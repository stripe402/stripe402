# @stripe402/client-fetch

Fetch wrapper that automatically handles stripe402 402 responses. Same behavior as `@stripe402/client-axios`, but wraps the native `fetch` API with zero dependencies beyond `@stripe402/core`.

## Install

```bash
npm install @stripe402/client-fetch
```

## Usage

```ts
import { createStripe402Fetch } from '@stripe402/client-fetch'

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    return { paymentMethodId: 'pm_...', topUpAmount: requirements.minTopUp }
  },
})

const response = await fetchWithPayment('https://api.example.com/api/weather')
const data = await response.json()
```

After the first successful payment, the wrapper stores the returned `clientId` and uses it for subsequent requests — no re-payment until credits run out.

Return `null` from `onPaymentRequired` to decline payment and return the original 402 response.

## Requirements

- Node.js >= 18.0.0 (native `fetch` required)

## Part of the stripe402 monorepo

See the [main repository](https://github.com/whatl3y/stripe402) for full documentation and the protocol specification.

## License

Apache-2.0 — see [LICENSE](./LICENSE) for details.
