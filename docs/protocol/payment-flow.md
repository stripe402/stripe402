# Payment Flow

This page describes every code path in the stripe402 middleware, from route matching to payment processing.

## Route Matching

The middleware matches requests by comparing `"${req.method} ${req.path}"` against the keys in `config.routes`. For example:

```ts
routes: {
  'GET /api/joke': { amount: 100 },
  'GET /api/weather': { amount: 500 },
}
```

A `GET /api/joke` request matches the first route. A `POST /api/joke` does not match. Routes not in the map pass through to the next middleware — they are free endpoints.

## Code Paths

The middleware has four main code paths:

### Path 1: Non-Paid Route (Passthrough)

```
Client → GET /api/health → No matching route → next() → Handler responds normally
```

If the route key (`METHOD /path`) is not in `config.routes`, the middleware calls `next()` and the request proceeds as normal. No payment logic runs.

### Path 2: No Payment Header (402 Challenge)

```
Client → GET /api/joke (no payment header) → 402 Payment Required
```

If the route matches but the request has no `payment` header, the middleware sends a 402 response with:

- **HTTP status**: 402
- **`payment-required` header**: Base64 JSON containing `PaymentRequiredResponse`
- **Response body**: Same data as the header (JSON)

The response includes the price (`amount`), minimum top-up (`minTopUp`), currency, and the server's Stripe publishable key so the client can tokenize a card.

### Path 3: Client ID With Sufficient Credits

```
Client → GET /api/joke + payment header (clientId) → Deduct balance → 200 OK
```

When the `payment` header contains a `clientId`:

1. The middleware calls `store.deductBalance(clientId, amount)`
2. If deduction succeeds (returns new balance), the middleware:
   - Sets the `payment-response` header with `success: true` and `creditsRemaining`
   - Optionally records a `deduction` transaction via `store.recordTransaction()`
   - Calls `next()` to serve the resource
3. If deduction fails (returns `null` — insufficient balance):
   - If no `paymentMethodId` is provided: sends a 402 with `error: 'insufficient_credits'`
   - If `paymentMethodId` is provided: falls through to Path 4 (new payment)

### Path 4: New Payment (Card Charge)

```
Client → GET /api/joke + payment header (paymentMethodId) → Charge card → Credit balance → Deduct → 200 OK
```

This is the full payment flow:

1. **Validate top-up amount**: `topUpAmount` defaults to `minTopUp` if not specified. If `topUpAmount < minTopUp`, returns error `top_up_below_minimum`.

2. **Get card fingerprint**: Calls `StripeService.getCardFingerprint(paymentMethodId)` to retrieve the card's fingerprint from Stripe.

3. **Derive client ID**: Calls `deriveClientId(fingerprint, serverSecret)` — HMAC-SHA256 of the fingerprint using the server secret.

4. **Find or create Stripe customer**: Calls `StripeService.findOrCreateCustomer(clientId, paymentMethodId)`. Searches for existing customer by `metadata["stripe402_client_id"]`, creates one if not found.

5. **Charge the card**: Calls `StripeService.createAndConfirmPayment()` with:
   - `amount`: `unitsToCents(topUpAmount)` — converts units to Stripe cents (rounds up)
   - `currency`: from route config (default `'usd'`)
   - `paymentMethodId`: from the client's payment header
   - `customerId`: from step 4
   - `description`: `"stripe402 top-up for {routeDescription or path}"`
   - `confirm: true` and `automatic_payment_methods.allow_redirects: 'never'`

6. **Verify payment**: If `paymentIntent.status !== 'succeeded'`, returns error `payment_failed`.

7. **Create client record**: If no existing client record, creates one with `balance: 0`.

8. **Credit balance**: Calls `store.addBalance(clientId, topUpAmount)`.

9. **Record top-up transaction**: If `store.recordTransaction` exists, records a `topup` transaction.

10. **Deduct for current request**: Calls `store.deductBalance(clientId, routeConfig.amount)`.

11. **Record deduction transaction**: If `store.recordTransaction` exists, records a `deduction` transaction.

12. **Respond**: Sets `payment-response` header with `success: true`, `chargeId` (PaymentIntent ID), `creditsRemaining`, and `clientId`. Calls `next()` to serve the resource.

## Error Handling

### Stripe Card Errors

If Stripe throws a `StripeCardError` (e.g., declined card, insufficient funds), the middleware returns:

```json
{
  "success": false,
  "creditsRemaining": 0,
  "clientId": "",
  "error": "Your card was declined.",
  "errorCode": "card_declined"
}
```

### Other Payment Errors

Any other error during payment processing returns:

```json
{
  "success": false,
  "creditsRemaining": 0,
  "clientId": "",
  "error": "Payment processing failed",
  "errorCode": "payment_failed"
}
```

### Malformed Payment Header

If the `payment` header cannot be decoded (invalid base64 or invalid JSON):

```json
{
  "success": false,
  "creditsRemaining": 0,
  "clientId": "",
  "error": "Malformed payment header",
  "errorCode": "invalid_payment"
}
```

## Helper Functions

The middleware uses three internal helper functions:

### `send402(res, routeConfig, publishableKey, url, currency, minTopUp, errorCode?)`

Sends a 402 response with:
- Status code 402
- `payment-required` header (base64-encoded `PaymentRequiredResponse`)
- JSON body (same data)

### `sendPaymentError(res, code, message)`

Sends a 402 response with a `PaymentResponse` body indicating failure. Used for card declined, payment failed, invalid payment, and top-up below minimum errors.

### `setPaymentResponseHeader(res, paymentResponse)`

Sets the `payment-response` header on a successful response (base64-encoded `PaymentResponse`).
