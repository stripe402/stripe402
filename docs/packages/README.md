# Packages Overview

stripe402 is organized as a monorepo with five publishable packages. Each package has a focused responsibility and minimal dependencies.

## Dependency Graph

```
@stripe402/core          (no external dependencies)
       │
       ├──── @stripe402/server        (+ stripe)
       │          │
       │          └──── @stripe402/express    (+ express peer dep)
       │
       ├──── @stripe402/client-axios   (+ axios peer dep)
       │
       └──── @stripe402/client-fetch   (no peer deps)
```

`@stripe402/core` is the foundation — all other packages depend on it. It has zero external dependencies (only Node.js built-in `crypto`).

## Package Summary

| Package | npm Name | Description | Dependencies |
|---------|----------|-------------|--------------|
| [core](core/README.md) | `@stripe402/core` | Protocol types, header encoding, HMAC identity, errors | None |
| [server](server/README.md) | `@stripe402/server` | Stripe API integration, Redis and PostgreSQL stores | `@stripe402/core`, `stripe` |
| [express](express/README.md) | `@stripe402/express` | Express middleware for payment-gated routes | `@stripe402/core`, `@stripe402/server` |
| [client-axios](client-axios/README.md) | `@stripe402/client-axios` | Axios interceptor for automatic 402 handling | `@stripe402/core` |
| [client-fetch](client-fetch/README.md) | `@stripe402/client-fetch` | Fetch wrapper for automatic 402 handling | `@stripe402/core` |

## Quick Import Reference

```ts
// Core — types, constants, utilities
import { encodeHeader, decodeHeader, deriveClientId, HEADERS, STRIPE402_VERSION } from '@stripe402/core'
import type { PaymentRequiredResponse, PaymentPayload, Stripe402Store } from '@stripe402/core'

// Server — Stripe integration and stores
import { StripeService, RedisStore, PostgresStore } from '@stripe402/server'

// Express — middleware
import { stripe402Middleware } from '@stripe402/express'

// Client (Axios)
import { createStripe402Axios } from '@stripe402/client-axios'

// Client (Fetch)
import { createStripe402Fetch } from '@stripe402/client-fetch'
```
