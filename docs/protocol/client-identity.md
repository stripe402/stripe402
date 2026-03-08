# Client Identity (HMAC)

stripe402 clients don't create accounts. Identity is derived deterministically from the payment card using HMAC-SHA256.

## How It Works

```
clientId = HMAC-SHA256(stripe_card_fingerprint, server_secret)
```

1. The client tokenizes their card via Stripe.js, producing a PaymentMethod ID (`pm_...`)
2. The server retrieves the card's **fingerprint** from Stripe — a consistent hash of the card number that Stripe generates
3. The server computes `HMAC-SHA256(fingerprint, serverSecret)` to produce the `clientId`
4. This `clientId` is returned to the client in the `payment-response` header
5. The client stores it and includes it in future requests

## Properties

| Property | Description |
|----------|-------------|
| **Deterministic** | Same card on the same server always produces the same client ID |
| **Irreversible** | The card fingerprint cannot be recovered from the client ID |
| **Server-isolated** | Different servers (different `serverSecret`) produce different IDs for the same card |
| **No registration** | Identity is derived from the payment itself — no email, no password |

## Implementation

From `@stripe402/core`:

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

**Parameters**:

| Parameter | Type | Description |
|-----------|------|-------------|
| `cardFingerprint` | `string` | Stripe card fingerprint (from `PaymentMethod.card.fingerprint`) |
| `serverSecret` | `string` | Server's HMAC key (from `SERVER_SECRET` env var or `Stripe402ServerConfig.serverSecret`) |

**Returns**: 64-character hex string (SHA-256 digest).

## Stripe Card Fingerprints

Stripe generates a fingerprint for each card that is:

- **Consistent per card number** within a Stripe account — the same card always produces the same fingerprint
- **Unique per Stripe account** — the same card number produces different fingerprints on different Stripe accounts
- **Not the card number** — it's a one-way hash, the card number cannot be recovered

The fingerprint is retrieved via `StripeService.getCardFingerprint(paymentMethodId)`, which calls `stripe.paymentMethods.retrieve(id)` and returns `pm.card.fingerprint`.

## Security Considerations

### Why HMAC instead of hashing the fingerprint directly?

Using HMAC with a server secret means:

- An attacker who obtains a client ID cannot derive the card fingerprint (even if they know the HMAC algorithm)
- An attacker who obtains a card fingerprint from one server cannot predict the client ID on another server
- The server secret adds an additional layer that is under the server operator's control

### Changing the Server Secret

If you change `SERVER_SECRET`, all existing client IDs become invalid. Clients will be treated as new — their existing credit balances become inaccessible (the balance is keyed by the old client ID). This effectively "resets" all clients.

### Cross-Service Privacy

Because different servers use different secrets, the same credit card produces different client IDs on different stripe402 services. This prevents cross-service tracking — server A cannot correlate a user on server B.
