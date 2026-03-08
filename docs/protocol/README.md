# Protocol Overview

stripe402 uses the HTTP 402 status code — reserved since 1997 but never standardized — to create a machine-readable payment negotiation between client and server.

## The Flow

```
Client                                          Server
  |                                                |
  |  1. GET /api/weather                           |
  |----------------------------------------------->|
  |                                                |
  |  2. 402 Payment Required                       |
  |  payment-required: <base64 JSON>               |
  |  (price, currency, min top-up, Stripe pub key) |
  |<-----------------------------------------------|
  |                                                |
  |  3. GET /api/weather                           |
  |  payment: <base64 JSON>                        |
  |  (PaymentMethod ID, top-up amount)             |
  |----------------------------------------------->|
  |                                                |
  |  Server charges card via Stripe                |
  |  Server credits balance                        |
  |  Server deducts for this request               |
  |                                                |
  |  4. 200 OK                                     |
  |  payment-response: <base64 JSON>               |
  |  (client ID, remaining credits, charge ID)     |
  |<-----------------------------------------------|
  |                                                |
  |  5. GET /api/weather                           |
  |  payment: <base64 JSON with client ID>         |
  |----------------------------------------------->|
  |                                                |
  |  Server deducts from balance                   |
  |                                                |
  |  6. 200 OK                                     |
  |  payment-response: <base64 JSON>               |
  |<-----------------------------------------------|
```

## Key Concepts

### No Signup Required

The payment **is** the authentication. A client's identity is derived deterministically from their card fingerprint via HMAC-SHA256. Same card, same server, same identity — every time. No passwords, no email, no registration.

### Credits System

Stripe charges a minimum of $0.50 with a ~$0.30 fixed fee per transaction. True per-request micropayments are uneconomical. stripe402 solves this with a credits system: clients top up once (e.g., $5.00 = 50,000 units), then make hundreds of requests against that balance. See [Credits Model](credits-model.md).

### Protocol Version

The current protocol version is `1` (constant: `STRIPE402_VERSION`). Both client and server include this in their headers for forward compatibility.

## Topics

- [HTTP Headers](http-headers.md) — the three headers and their JSON schemas
- [Payment Flow](payment-flow.md) — detailed walkthrough of all code paths
- [Pricing Units](pricing-units.md) — the unit system and conversions
- [Client Identity](client-identity.md) — HMAC-SHA256 derivation
- [Credits Model](credits-model.md) — why credits, how top-ups work
- [Error Codes](error-codes.md) — all error codes and when they occur
- [Comparison: stripe402 vs x402](comparison-x402.md) — trade-offs between the two approaches
