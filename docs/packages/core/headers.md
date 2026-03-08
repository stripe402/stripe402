# Header Encoding

Functions for encoding and decoding stripe402 protocol headers as base64 JSON strings.

## `encodeHeader<T>(data: T): string`

Encode an object as a base64 JSON string for use in HTTP headers.

```ts
export function encodeHeader<T>(data: T): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `data` | `T` | Any JSON-serializable object. |

### Returns

`string` — Base64-encoded JSON string.

### Example

```ts
import { encodeHeader } from '@stripe402/core'

const header = encodeHeader({
  stripe402Version: 1,
  clientId: 'abc123',
})
// => 'eyJzdHJpcGU0MDJWZXJzaW9uIjoxLCJjbGllbnRJZCI6ImFiYzEyMyJ9'
```

## `decodeHeader<T>(header: string): T`

Decode a base64 JSON header string back to a typed object.

```ts
export function decodeHeader<T>(header: string): T {
  const json = Buffer.from(header, 'base64').toString('utf-8')
  return JSON.parse(json) as T
}
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `header` | `string` | Base64-encoded JSON string from an HTTP header. |

### Returns

`T` — The decoded and parsed object, cast to the specified type.

### Throws

- `SyntaxError` — if the decoded string is not valid JSON.
- May throw if the input is not valid base64 (implementation-dependent on `Buffer.from` behavior).

### Example

```ts
import { decodeHeader, type PaymentPayload } from '@stripe402/core'

const payload = decodeHeader<PaymentPayload>(
  'eyJzdHJpcGU0MDJWZXJzaW9uIjoxLCJjbGllbnRJZCI6ImFiYzEyMyJ9'
)
// => { stripe402Version: 1, clientId: 'abc123' }
```

## Why Base64 JSON?

This encoding follows the [x402 convention](https://x402.org). The benefits:

1. **Keeps the body free** — Payment data is in headers, so the response body can contain the actual resource (on 200) or a human-readable paywall page (on 402).
2. **Machine-readable** — Headers are easily parsed by automated clients and AI agents.
3. **HTTP-safe** — Base64 encoding avoids issues with special characters in header values.
