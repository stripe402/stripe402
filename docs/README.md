# stripe402

An HTTP 402 payment protocol for API monetization using Stripe. Inspired by [x402](https://x402.org), but built on traditional credit card rails instead of blockchain settlement.

stripe402 enables machine-readable, automatic payment negotiation between clients and servers. No signup, no API keys, no OAuth — just an HTTP header. A client with a credit card can pay for any stripe402-enabled API on the first request.

## What is stripe402?

stripe402 turns the HTTP 402 status code — reserved since 1997 but never standardized — into a practical payment protocol. When a client requests a paid resource, the server responds with 402 and a machine-readable description of the price and how to pay. The client tokenizes a card via Stripe, retries with a payment header, and the server charges the card, credits a balance, and serves the resource.

Subsequent requests use a client ID (derived from the card fingerprint) to deduct from the credit balance — no payment until credits run out.

## Key Features

- **Zero-signup API monetization** — no accounts, no API keys, no dashboards
- **Credit card payments via Stripe** — the payment rail used by 99% of the internet
- **Sub-cent pricing** — credits system enables micropayments (1 unit = 1/10,000 of a dollar)
- **Agentic payments** — AI agents can discover and pay for APIs autonomously
- **Multiple persistence backends** — Redis (fast) and PostgreSQL (durable) included
- **Framework-agnostic core** — Express middleware included, easy to add others

## Packages

| Package | Description |
|---------|-------------|
| `@stripe402/core` | Protocol types, header encoding, HMAC identity, error types |
| `@stripe402/server` | Stripe integration, Redis and PostgreSQL stores |
| `@stripe402/express` | Express middleware for payment-gated routes |
| `@stripe402/client-axios` | Axios interceptor for automatic 402 handling |
| `@stripe402/client-fetch` | Fetch wrapper for automatic 402 handling |

## Quick Links

- [Getting Started](getting-started/README.md) — install and run in 5 minutes
- [Protocol Overview](protocol/README.md) — how the payment flow works
- [Package Reference](packages/README.md) — detailed API docs for each package
- [Guides](guides/README.md) — step-by-step tutorials
- [Configuration Reference](reference/configuration.md) — all settings and options
