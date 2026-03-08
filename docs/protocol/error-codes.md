# Error Codes

stripe402 defines six error codes in the `PaymentErrorCode` type. These are returned in the `errorCode` field of `PaymentResponse` when a payment fails.

## Error Code Reference

### `payment_required`

The initial 402 challenge. No error has occurred — the server is informing the client that this resource requires payment.

- **When**: Client requests a paid route without a `payment` header
- **HTTP Status**: 402
- **Included in**: `PaymentRequiredResponse.error` field

### `insufficient_credits`

The client has an existing credit balance, but it's not enough for this request.

- **When**: `store.deductBalance()` returns `null` (balance < amount) and no `paymentMethodId` was provided
- **HTTP Status**: 402
- **Action**: Client should retry with a `paymentMethodId` to top up credits

### `card_declined`

Stripe rejected the card (e.g., insufficient funds, expired card, fraud detection).

- **When**: Stripe throws a `StripeCardError` during `PaymentIntent.create()`
- **HTTP Status**: 402
- **Error message**: The message from Stripe (e.g., "Your card was declined.")

### `payment_failed`

The payment was processed but did not succeed, or an unexpected error occurred during payment processing.

- **When**: `paymentIntent.status !== 'succeeded'`, or any non-card Stripe error
- **HTTP Status**: 402
- **Error message**: Includes the PaymentIntent status or the error message

### `invalid_payment`

The `payment` header could not be decoded — it's not valid base64 or not valid JSON.

- **When**: `decodeHeader()` throws during parsing of the `payment` header
- **HTTP Status**: 402
- **Error message**: "Malformed payment header"

### `top_up_below_minimum`

The client specified a `topUpAmount` that is below the route's `minTopUp`.

- **When**: `payload.topUpAmount < minTopUp`
- **HTTP Status**: 402
- **Error message**: "Top-up amount {amount} is below the minimum of {minTopUp}"

## TypeScript Type

```ts
export type PaymentErrorCode =
  | 'payment_required'
  | 'card_declined'
  | 'insufficient_credits'
  | 'payment_failed'
  | 'invalid_payment'
  | 'top_up_below_minimum'
```

## Error Response Format

All payment errors are returned as a `PaymentResponse` JSON body:

```json
{
  "success": false,
  "creditsRemaining": 0,
  "clientId": "",
  "error": "Human-readable error message",
  "errorCode": "card_declined"
}
```

The `Stripe402Error` class in `@stripe402/core` can be used to create typed errors:

```ts
import { Stripe402Error } from '@stripe402/core'

throw new Stripe402Error('card_declined', 'Your card was declined.')
// error.code  => 'card_declined'
// error.name  => 'Stripe402Error'
```
