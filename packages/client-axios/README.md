# @stripe402/client-axios

Axios interceptor that automatically handles stripe402 402 responses. When a paid endpoint returns 402, the interceptor calls your callback to get payment details, then retries the request transparently.

## Install

```bash
npm install @stripe402/client-axios axios
```

## Usage

```ts
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const client = createStripe402Axios(axios.create(), {
  onPaymentRequired: async (requirements) => {
    // requirements includes: amount, minTopUp, currency, publishableKey, description
    const pm = await stripe.createPaymentMethod(/* ... */)
    return { paymentMethodId: pm.id, topUpAmount: requirements.minTopUp }
  },
})

// Automatically handles 402 → payment → retry
const response = await client.get('https://api.example.com/api/weather')
```

After the first successful payment, the client stores the returned `clientId` and uses it for subsequent requests — no re-payment until credits run out.

Return `null` from `onPaymentRequired` to decline payment and let the 402 error propagate.

## Requirements

- Node.js >= 16.0.0
- **Peer dependency**: `axios` >= 1.0.0

## Part of the stripe402 monorepo

See the [main repository](https://github.com/whatl3y/stripe402) for full documentation and the protocol specification.

## License

Apache-2.0 — see [LICENSE](./LICENSE) for details.
