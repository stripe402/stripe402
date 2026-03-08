# Installation

## Server-Side

Install the Express middleware and server packages:

```bash
pnpm add @stripe402/express @stripe402/server
```

This also installs `@stripe402/core` as a transitive dependency.

### Peer Dependencies

The following peer dependencies must be installed separately based on your setup:

| Peer Dependency | Required By | Required? | Notes |
|-----------------|-------------|-----------|-------|
| `express` >= 4.0.0 | `@stripe402/express` | Yes | Tested with Express 5.1 |
| `stripe` >= 17.7.0 | `@stripe402/server` | Yes | Stripe Node.js SDK |
| `ioredis` >= 5.0.0 | `@stripe402/server` | If using RedisStore | Redis client |
| `pg` >= 8.0.0 | `@stripe402/server` | If using PostgresStore | PostgreSQL client |

Install peer dependencies for your chosen store:

```bash
# With Redis (recommended)
pnpm add express stripe ioredis

# With PostgreSQL
pnpm add express stripe pg
```

## Client-Side

Choose one client package based on your HTTP library:

### Axios

```bash
pnpm add @stripe402/client-axios axios
```

Peer dependency: `axios` >= 1.0.0

### Fetch (native)

```bash
pnpm add @stripe402/client-fetch
```

No peer dependencies — uses the native `fetch` API (available in Node.js 18+).

## Core Only

If you're building a custom integration (e.g., a middleware for a different framework), install the core package directly:

```bash
pnpm add @stripe402/core
```

This gives you access to all protocol types, header encoding/decoding, HMAC identity derivation, and error types — with zero external dependencies.
