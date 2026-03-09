# @stripe402/core

Protocol types, constants, header encoding/decoding, HMAC identity derivation, and error types for the stripe402 protocol. Zero external dependencies (Node.js crypto only).

## Install

```bash
npm install @stripe402/core
```

## Usage

### Header encoding/decoding

```ts
import { encodeHeader, decodeHeader } from '@stripe402/core'

const encoded = encodeHeader({ amount: 500, currency: 'usd' })
const decoded = decodeHeader<{ amount: number; currency: string }>(encoded)
```

### Client identity derivation

```ts
import { deriveClientId } from '@stripe402/core'

// Deterministic: same card fingerprint + server secret = same client ID
const clientId = deriveClientId(cardFingerprint, serverSecret)
```

### Unit conversion

```ts
import { unitsToCents, unitsToDollars, UNITS_PER_CENT } from '@stripe402/core'

unitsToCents(500)    // 5 (cents)
unitsToDollars(500)  // "0.05"
```

### Types

Key types exported: `PaymentRequiredResponse`, `PaymentPayload`, `PaymentResponse`, `RouteConfig`, `Stripe402ServerConfig`, `Stripe402ClientConfig`, `Stripe402Store`, `ClientRecord`, `TransactionRecord`.

## Requirements

- Node.js >= 16.0.0

## Part of the stripe402 monorepo

See the [main repository](https://github.com/whatl3y/stripe402) for full documentation and the protocol specification.

## License

Apache-2.0 — see [LICENSE](./LICENSE) for details.
