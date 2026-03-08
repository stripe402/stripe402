# Known Limitations

Current limitations of the stripe402 protocol and implementation.

## 3D Secure / SCA

EU cards may require **3D Secure** (Strong Customer Authentication) for online payments. 3D Secure involves an interactive authentication step (e.g., a redirect to the bank's website or a push notification), which breaks headless/machine-to-machine flows.

The middleware uses `automatic_payment_methods.allow_redirects: 'never'` to prevent redirects, but this means EU cards requiring 3D Secure may fail.

**Mitigations**:
- Low-value exemptions may apply (transactions under EUR 30, with cumulative limits)
- Stripe's machine learning may flag low-risk transactions for exemption
- Recurring transactions after initial authentication may not require SCA

## Stripe Minimum Charge

Stripe requires a **minimum charge of $0.50 USD** (or equivalent in other currencies). This means:

- `minTopUp` must be at least 500 units ($0.50)
- The recommended minimum is 50,000 units ($5.00) to amortize Stripe's ~$0.30 fixed fee
- True sub-cent per-request pricing is only possible via the credits system, not direct charges

## PCI Scope for Server-Side Clients

**Browser clients**: Using Stripe.js for card tokenization keeps clients at **SAQ-A** scope (22 PCI requirements). Card data never touches your servers.

**Server-side clients**: Clients running in Node.js that create PaymentMethods directly (e.g., AI agents with stored card data) are in **SAQ-D** scope (300+ requirements). However, if they only use pre-created PaymentMethod IDs (e.g., `pm_...` stored as secrets), PCI scope is limited because the actual card data was tokenized elsewhere.

**Recommendation**: Always tokenize cards via Stripe.js in a browser, then store the resulting PaymentMethod ID for server-side use.

## Single Currency Per Route

Each route is configured with one currency (`RouteConfig.currency`, default `'usd'`). Multi-currency support — where the same route accepts different currencies — is not currently supported.

**Workaround**: Create separate routes for different currencies:

```ts
routes: {
  'GET /api/weather-usd': { amount: 500, currency: 'usd' },
  'GET /api/weather-eur': { amount: 450, currency: 'eur' },
}
```

## No Pattern Matching in Routes

Route matching is exact string comparison (`"GET /api/weather"`). There is no support for:

- Wildcard routes (`GET /api/*`)
- Path parameters (`GET /api/users/:id`)
- Regular expressions

Each paid endpoint must be listed explicitly in the routes map.

## Chargeback Risk

Unlike crypto payments (which are irreversible), credit card payments are subject to chargebacks. A client can dispute a charge with their bank, and the server operator may lose both the funds and a chargeback fee.

**Mitigations**:
- The credits model means individual requests have no associated charge (only top-ups)
- Stripe provides chargeback protection tools and dispute management
- Transaction records enable evidence submission for disputes

## No Built-in Rate Limiting

The middleware does not include rate limiting. A client with credits can make requests as fast as their network allows. Rate limiting should be implemented separately (e.g., `express-rate-limit`).

## Single Store Instance

The middleware assumes a single `Stripe402Store` instance shared across all routes. There is no support for different stores per route (e.g., Redis for some routes, PostgreSQL for others).
