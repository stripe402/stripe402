# Table of Contents

* [Introduction](README.md)

## Getting Started

* [Overview](getting-started/README.md)
* [Installation](getting-started/installation.md)
* [Quick Start](getting-started/quick-start.md)
* [Environment Variables](getting-started/environment-variables.md)

## Protocol

* [Overview](protocol/README.md)
* [HTTP Headers](protocol/http-headers.md)
* [Payment Flow](protocol/payment-flow.md)
* [Pricing Units](protocol/pricing-units.md)
* [Client Identity (HMAC)](protocol/client-identity.md)
* [Credits Model](protocol/credits-model.md)
* [Error Codes](protocol/error-codes.md)
* [Comparison: stripe402 vs x402](protocol/comparison-x402.md)

## Packages

* [Overview & Dependency Graph](packages/README.md)
* [@stripe402/core](packages/core/README.md)
  * [Types & Interfaces](packages/core/types.md)
  * [Constants & Utilities](packages/core/constants.md)
  * [Header Encoding](packages/core/headers.md)
  * [Client Identity](packages/core/identity.md)
  * [Error Classes](packages/core/errors.md)
* [@stripe402/server](packages/server/README.md)
  * [StripeService](packages/server/stripe-service.md)
  * [Store Interface](packages/server/store-interface.md)
  * [RedisStore](packages/server/redis-store.md)
  * [PostgresStore](packages/server/postgres-store.md)
* [@stripe402/express](packages/express/README.md)
  * [Middleware](packages/express/middleware.md)
* [@stripe402/client-axios](packages/client-axios/README.md)
  * [Axios Interceptor](packages/client-axios/interceptor.md)
* [@stripe402/client-fetch](packages/client-fetch/README.md)
  * [Fetch Wrapper](packages/client-fetch/wrapper.md)

## Guides

* [Overview](guides/README.md)
* [Server Setup](guides/server-setup.md)
* [Client Integration](guides/client-integration.md)
* [Creating Payment Methods](guides/creating-payment-methods.md)
* [Custom Store Backend](guides/custom-store.md)
* [Docker Deployment](guides/docker-deployment.md)
* [Agentic Payments](guides/agentic-payments.md)

## Reference

* [Overview](reference/README.md)
* [Configuration Reference](reference/configuration.md)
* [PostgreSQL Schema](reference/database-schema.md)
* [Redis Key Patterns](reference/redis-keys.md)

## Development

* [Overview](development/README.md)
* [Monorepo Structure](development/monorepo-structure.md)
* [Building & Scripts](development/building.md)
* [Testing](development/testing.md)
* [Contributing](development/contributing.md)

---

* [Design Decisions](design-decisions.md)
* [Known Limitations](known-limitations.md)
* [License](license.md)
