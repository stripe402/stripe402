# Client Identity

The `deriveClientId` function generates a deterministic client identifier from a Stripe card fingerprint and a server secret.

## `deriveClientId(cardFingerprint: string, serverSecret: string): string`

```ts
import { createHmac } from 'crypto'

export function deriveClientId(
  cardFingerprint: string,
  serverSecret: string
): string {
  return createHmac('sha256', serverSecret)
    .update(cardFingerprint)
    .digest('hex')
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `cardFingerprint` | `string` | Stripe card fingerprint from `PaymentMethod.card.fingerprint`. Consistent per card number within a Stripe account. |
| `serverSecret` | `string` | Server's HMAC key. From `SERVER_SECRET` env var or `Stripe402ServerConfig.serverSecret`. |

### Returns

`string` — 64-character hexadecimal string (SHA-256 HMAC digest).

### Example

```ts
import { deriveClientId } from '@stripe402/core'

const clientId = deriveClientId('fp_abc123xyz', 'my-server-secret')
// => '7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b'
```

### Properties

| Property | Description |
|----------|-------------|
| **Deterministic** | Same inputs always produce the same output. |
| **Irreversible** | Cannot recover `cardFingerprint` from the output (HMAC is a one-way function). |
| **Server-isolated** | Different `serverSecret` values produce different client IDs for the same card. |
| **Collision-resistant** | SHA-256 has 2^256 possible outputs — collisions are practically impossible. |

See [Client Identity (HMAC)](../../protocol/client-identity.md) for a detailed explanation of why HMAC is used and the security properties.
