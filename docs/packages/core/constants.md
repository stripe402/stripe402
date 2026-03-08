# Constants & Utilities

Constants and utility functions exported from `@stripe402/core`.

## Protocol Constants

### `STRIPE402_VERSION`

```ts
export const STRIPE402_VERSION = 1
```

The current protocol version number. Included in all protocol messages (`PaymentRequiredResponse`, `PaymentPayload`) for forward compatibility.

### `HEADERS`

```ts
export const HEADERS = {
  PAYMENT_REQUIRED: 'payment-required',
  PAYMENT: 'payment',
  PAYMENT_RESPONSE: 'payment-response',
} as const
```

HTTP header names used by the protocol:

| Constant | Value | Direction | Description |
|----------|-------|-----------|-------------|
| `HEADERS.PAYMENT_REQUIRED` | `'payment-required'` | Server → Client | 402 response containing `PaymentRequiredResponse` |
| `HEADERS.PAYMENT` | `'payment'` | Client → Server | Retry request containing `PaymentPayload` |
| `HEADERS.PAYMENT_RESPONSE` | `'payment-response'` | Server → Client | 200 response containing `PaymentResponse` |

## Unit Constants

### `UNITS_PER_DOLLAR`

```ts
export const UNITS_PER_DOLLAR = 10_000
```

Number of units per dollar. 1 unit = 1/10,000 of a dollar ($0.0001).

### `UNITS_PER_CENT`

```ts
export const UNITS_PER_CENT = 100
```

Number of units per cent. 1 cent = 100 units.

### `DEFAULT_MIN_TOP_UP`

```ts
export const DEFAULT_MIN_TOP_UP = 50_000
```

Default minimum top-up amount in units. 50,000 units = $5.00. Used when `RouteConfig.minTopUp` is not specified.

### `DEFAULT_CURRENCY`

```ts
export const DEFAULT_CURRENCY = 'usd'
```

Default currency code. Used when `RouteConfig.currency` is not specified.

## Utility Functions

### `unitsToCents(units: number): number`

Converts units to Stripe cents, rounding **up** to the nearest cent.

```ts
export function unitsToCents(units: number): number {
  return Math.ceil(units / UNITS_PER_CENT)
}
```

| Input (units) | Output (cents) | Dollars |
|---------------|----------------|---------|
| `1` | `1` | $0.01 |
| `100` | `1` | $0.01 |
| `101` | `2` | $0.02 |
| `500` | `5` | $0.05 |
| `50000` | `500` | $5.00 |

The rounding-up behavior ensures the server never undercharges. For example, 1 unit ($0.0001) rounds up to 1 cent ($0.01) because Stripe doesn't support sub-cent charges.

### `unitsToDollars(units: number): string`

Converts units to a human-readable dollar string. Trailing zeros and trailing decimal points are removed.

```ts
export function unitsToDollars(units: number): string {
  return (units / UNITS_PER_DOLLAR).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
```

| Input (units) | Output (string) |
|---------------|-----------------|
| `1` | `'0.0001'` |
| `100` | `'0.01'` |
| `500` | `'0.05'` |
| `10000` | `'1'` |
| `50000` | `'5'` |
| `12345` | `'1.2345'` |

This function is for display only — it returns a string, not a number.
