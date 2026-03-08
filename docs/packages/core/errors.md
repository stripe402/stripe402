# Error Classes

## `Stripe402Error`

A custom error class for stripe402 payment errors.

```ts
import type { PaymentErrorCode } from './types'

export class Stripe402Error extends Error {
  public readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message: string) {
    super(message)
    this.name = 'Stripe402Error'
    this.code = code
  }
}
```

### Constructor

```ts
new Stripe402Error(code: PaymentErrorCode, message: string)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | `PaymentErrorCode` | One of the six error codes: `'payment_required'`, `'card_declined'`, `'insufficient_credits'`, `'payment_failed'`, `'invalid_payment'`, `'top_up_below_minimum'`. |
| `message` | `string` | Human-readable error description. |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `code` | `PaymentErrorCode` | The machine-readable error code. Read-only. |
| `name` | `string` | Always `'Stripe402Error'`. |
| `message` | `string` | The human-readable error message (inherited from `Error`). |

### Example

```ts
import { Stripe402Error } from '@stripe402/core'

const error = new Stripe402Error('card_declined', 'Your card was declined.')

error.code     // => 'card_declined'
error.name     // => 'Stripe402Error'
error.message  // => 'Your card was declined.'

// Type checking
if (error instanceof Stripe402Error) {
  console.log(`Payment error: ${error.code}`)
}
```

### Usage in the Middleware

The middleware does not throw `Stripe402Error` directly — it uses `sendPaymentError()` to return error responses as JSON. However, `Stripe402Error` is useful for:

- Custom middleware implementations that need typed payment errors
- Client-side error handling where you want to distinguish payment errors from other errors
- Building custom store implementations that need to signal payment-specific failures
