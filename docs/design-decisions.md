# Design Decisions

Why things are built the way they are.

## Why Not Raw Card Numbers?

Handling raw card numbers requires **SAQ-D PCI compliance**: 300+ security requirements, annual audits, and significant operational overhead.

By using Stripe.js for client-side tokenization, servers stay at **SAQ-A** (22 requirements). Card data never touches your infrastructure — clients send a Stripe PaymentMethod ID, not card numbers.

## Why HMAC for Client Identity?

Client IDs are derived via `HMAC-SHA256(card_fingerprint, server_secret)`. This provides:

- **Deterministic**: Same card always maps to the same client ID on a given server. No registration needed.
- **Private**: The card fingerprint cannot be recovered from the client ID (HMAC is a one-way function).
- **Isolated**: Different servers use different secrets, so the same card produces different client IDs. No cross-service tracking.
- **No registration**: Identity is derived from the payment itself — no email, password, or account creation.

Alternatives considered:
- **Hashing the fingerprint directly** (SHA-256 without key): Attacker with a fingerprint database could precompute all client IDs. HMAC's server secret prevents this.
- **Random client IDs**: Would require the client to store and present the ID. HMAC makes it deterministic — the server can always re-derive it from the card.

## Why Not Stripe's Built-in Customer Balance?

Stripe's `customer.balance` is tightly coupled to their invoicing system — it automatically applies to the next invoice rather than being a general-purpose wallet.

For a flexible credits system with per-request deductions at microsecond latency, a custom ledger with atomic operations is more appropriate. Redis can deduct a balance in <1ms; a Stripe API call takes 200-500ms.

## Why Atomic Balance Operations?

Concurrent API requests from the same client must not overdraw the balance. Consider:

1. Client has 500 units
2. Request A reads balance: 500
3. Request B reads balance: 500
4. Request A deducts 200: writes 300
5. Request B deducts 200: writes 300

Both succeed, but only 200 units were deducted instead of 400. The client got a free request.

Both stores use database-level atomicity:

- **Redis**: Lua script checks and deducts in a single atomic operation (Redis is single-threaded, so Lua scripts run without interruption)
- **PostgreSQL**: `UPDATE ... WHERE balance >= amount RETURNING balance` — the WHERE clause prevents negative balances, and row-level locking prevents concurrent reads from both succeeding

## Why Base64 Headers?

Following x402's convention: payment data is JSON-encoded then base64-encoded in HTTP headers. Benefits:

1. **Keeps the body free**: The response body can contain the actual resource (on 200) or a human-readable paywall page (on 402). Payment metadata rides alongside in headers without interfering.
2. **Machine-readable**: Automated clients and AI agents can parse headers without parsing the body.
3. **HTTP-safe**: Base64 avoids issues with special characters in header values.

## Why Credits Instead of Per-Request Billing?

Stripe imposes a **$0.50 minimum charge** and a **~$0.30 fixed fee** per transaction. If an API call costs $0.01:

- Per-request: $0.30+ fees on a $0.01 charge (3,000% overhead, and below the $0.50 minimum anyway)
- Credits: $0.30 fee on a $5.00 top-up (6% overhead, amortized over 500 requests)

The credits model makes micropayments economically viable on traditional payment rails.

## Why CommonJS (Not ESM)?

The TypeScript is compiled to CommonJS (`"module": "commonjs"` in tsconfig). While ESM is the future, CommonJS provides:

- Maximum compatibility with the Node.js ecosystem
- Works in all Node.js versions without `--experimental-modules`
- Compatible with both `require()` and dynamic `import()`
- Most Stripe SDK and Express middleware examples use CommonJS

A future version may add dual ESM/CJS publishing.
