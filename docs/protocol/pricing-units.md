# Pricing Units

All monetary amounts in stripe402 are expressed in **units**, where 1 unit = 1/10,000 of a dollar. This enables sub-cent pricing for high-volume, low-cost API calls.

## Conversion Table

| Units | Dollars | Cents | Example Use |
|-------|---------|-------|-------------|
| 1 | $0.0001 | 0.01¢ | Ultra-low-cost operations |
| 100 | $0.01 | 1¢ | Joke API, simple lookups |
| 500 | $0.05 | 5¢ | Weather data, translations |
| 1,000 | $0.10 | 10¢ | Image generation |
| 10,000 | $1.00 | 100¢ | Complex computations |
| 50,000 | $5.00 | 500¢ | Default minimum top-up |

## Constants

Defined in `@stripe402/core`:

```ts
/** Number of units per dollar (1 unit = 1/10,000 of a dollar) */
export const UNITS_PER_DOLLAR = 10_000

/** Number of units per cent (1 cent = 100 units) */
export const UNITS_PER_CENT = 100

/** Default minimum top-up amount in units ($5.00 = 50,000 units) */
export const DEFAULT_MIN_TOP_UP = 50_000

/** Default currency */
export const DEFAULT_CURRENCY = 'usd'
```

## Conversion Functions

### `unitsToCents(units: number): number`

Converts units to Stripe cents, rounding **up** to the nearest cent. Stripe charges in cents, so this conversion happens before every `PaymentIntent.create()` call.

```ts
import { unitsToCents } from '@stripe402/core'

unitsToCents(100)    // => 1    ($0.01)
unitsToCents(150)    // => 2    ($0.02) — rounds up
unitsToCents(500)    // => 5    ($0.05)
unitsToCents(50000)  // => 500  ($5.00)
unitsToCents(1)      // => 1    ($0.01) — rounds up from 0.01 cents
```

Implementation: `Math.ceil(units / UNITS_PER_CENT)` — always rounds up so the server never undercharges.

### `unitsToDollars(units: number): string`

Converts units to a human-readable dollar string for display purposes. Trailing zeros are trimmed.

```ts
import { unitsToDollars } from '@stripe402/core'

unitsToDollars(100)    // => '0.01'
unitsToDollars(500)    // => '0.05'
unitsToDollars(10000)  // => '1'
unitsToDollars(50000)  // => '5'
unitsToDollars(1)      // => '0.0001'
unitsToDollars(12345)  // => '1.2345'
```

Implementation: `(units / UNITS_PER_DOLLAR).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')` — formats to 4 decimal places, then strips trailing zeros and trailing decimal point.

## How Units Flow Through the System

1. **Route configuration**: Price is set in units (`amount: 500` = 5¢ per request)
2. **402 response**: Units are sent to the client as-is in `PaymentRequirements.amount`
3. **Top-up**: Client specifies `topUpAmount` in units (must be >= `minTopUp`)
4. **Stripe charge**: Units are converted to cents via `unitsToCents()` for the PaymentIntent
5. **Balance**: Credits are stored and deducted in units
6. **Display**: `unitsToDollars()` formats units for human-readable output
