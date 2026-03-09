# @stripe402/core

All TypeScript types, constants, header encoding/decoding, HMAC identity derivation, and error types for the stripe402 protocol.

No external dependencies (only Node.js built-in `crypto`). Framework-agnostic. Pulled in automatically when you install any other stripe402 package.

## Installation

```bash
pnpm add @stripe402/core
```

Usually you don't need to install this directly — it's a dependency of `@stripe402/server`, `@stripe402/express`, `@stripe402/client-axios`, and `@stripe402/client-fetch`.

## Exports

All exports are re-exported from the package entry point:

```ts
// types.ts — All TypeScript interfaces and types
export * from './types'

// constants.ts — Protocol version, header names, unit conversion
export * from './constants'

// headers.ts — Base64 JSON encoding/decoding
export * from './headers'

// identity.ts — HMAC-SHA256 client ID derivation
export * from './identity'

// errors.ts — Stripe402Error class
export * from './errors'
```

## Sub-Pages

- [Types & Interfaces](types.md) — all 12+ interfaces and type definitions
- [Constants & Utilities](constants.md) — version, headers, unit conversions
- [Header Encoding](headers.md) — `encodeHeader()` and `decodeHeader()`
- [Client Identity](identity.md) — `deriveClientId()`
- [Error Classes](errors.md) — `Stripe402Error`
