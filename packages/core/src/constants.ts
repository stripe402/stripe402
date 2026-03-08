/** Current protocol version */
export const STRIPE402_VERSION = 1

/** HTTP header names */
export const HEADERS = {
  /** Server -> Client: 402 response header containing PaymentRequiredResponse */
  PAYMENT_REQUIRED: 'payment-required',
  /** Client -> Server: retry request header containing PaymentPayload */
  PAYMENT: 'payment',
  /** Server -> Client: 200 response header containing PaymentResponse */
  PAYMENT_RESPONSE: 'payment-response',
} as const

/** Number of units per dollar (1 unit = 1/10000 of a dollar) */
export const UNITS_PER_DOLLAR = 10_000

/** Number of units per cent (1 cent = 100 units) */
export const UNITS_PER_CENT = 100

/** Default minimum top-up amount in units ($5.00 = 50000 units) */
export const DEFAULT_MIN_TOP_UP = 50_000

/** Default currency */
export const DEFAULT_CURRENCY = 'usd'

/** Convert units to Stripe cents (rounds up to nearest cent) */
export function unitsToCents(units: number): number {
  return Math.ceil(units / UNITS_PER_CENT)
}

/** Convert units to dollar string for display */
export function unitsToDollars(units: number): string {
  return (units / UNITS_PER_DOLLAR).toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}
