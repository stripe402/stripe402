/**
 * Core protocol types for stripe402
 */

// --- Protocol Messages ---

/** Server -> Client: included in 402 response PAYMENT-REQUIRED header */
export interface PaymentRequiredResponse {
  stripe402Version: number
  resource: ResourceInfo
  accepts: PaymentRequirements[]
  error?: string
}

/** Describes the resource being requested */
export interface ResourceInfo {
  url: string
  description?: string
  mimeType?: string
}

/** A single accepted payment option */
export interface PaymentRequirements {
  scheme: 'stripe'
  currency: string
  /** Cost of this request in units (1 unit = 1/10000 of a dollar, e.g., 100 = 1¢) */
  amount: number
  /** Minimum top-up charge in units (e.g., 50000 = $5.00) */
  minTopUp: number
  /** Stripe publishable key for client-side tokenization */
  publishableKey: string
  /** Human-readable description of what the payment is for */
  description?: string
}

/** Client -> Server: included in retry request PAYMENT header */
export interface PaymentPayload {
  stripe402Version: number
  /** Stripe PaymentMethod ID from client-side tokenization */
  paymentMethodId?: string
  /** Client identifier for credit balance lookups */
  clientId?: string
  /** Amount to top up in units (must be >= minTopUp) */
  topUpAmount?: number
}

/** Server -> Client: included in 200 response PAYMENT-RESPONSE header */
export interface PaymentResponse {
  success: boolean
  /** Stripe PaymentIntent ID */
  chargeId?: string
  /** Remaining credits in units */
  creditsRemaining: number
  /** Client identifier for future requests */
  clientId: string
  error?: string
  errorCode?: PaymentErrorCode
}

// --- Persistence ---

/** A client record stored in the persistence layer */
export interface ClientRecord {
  clientId: string
  stripeCustomerId: string
  balance: number
  currency: string
  createdAt: Date
  updatedAt: Date
}

/** A transaction log entry */
export interface TransactionRecord {
  id: string
  clientId: string
  type: 'topup' | 'deduction'
  amount: number
  stripePaymentIntentId?: string
  resource?: string
  createdAt: Date
}

/** Persistence store interface — implementations must ensure atomic balance operations */
export interface Stripe402Store {
  /** Get a client record by ID, or null if not found */
  getClient(clientId: string): Promise<ClientRecord | null>

  /** Create a new client record */
  createClient(record: ClientRecord): Promise<void>

  /**
   * Atomically deduct from a client's balance.
   * Must only succeed if balance >= amount.
   * Returns the new balance, or null if insufficient funds.
   */
  deductBalance(clientId: string, amount: number): Promise<number | null>

  /**
   * Add to a client's balance. Returns the new balance.
   */
  addBalance(clientId: string, amount: number): Promise<number>

  /**
   * Record a transaction (optional — stores that support audit logging should implement this).
   */
  recordTransaction?(transaction: TransactionRecord): Promise<void>
}

// --- Server Configuration ---

/** Configuration for a single paid route */
export interface RouteConfig {
  /** Cost per request in units (1 unit = 1/10000 of a dollar) */
  amount: number
  /** Currency code (default: 'usd') */
  currency?: string
  /** Minimum top-up amount in units (default: 50000 = $5.00) */
  minTopUp?: number
  /** Human-readable description */
  description?: string
}

/** Full middleware configuration */
export interface Stripe402ServerConfig {
  stripeSecretKey: string
  stripePublishableKey: string
  /** Secret used to derive client IDs from card fingerprints (HMAC key) */
  serverSecret: string
  /** Persistence store for client records and balances */
  store: Stripe402Store
  /** Map of "METHOD /path" to route config */
  routes: Record<string, RouteConfig>
}

// --- Client Configuration ---

/** Callback invoked when a 402 response requires payment */
export type OnPaymentRequired = (
  requirements: PaymentRequirements
) => Promise<{ paymentMethodId: string; topUpAmount?: number } | null>

/** Configuration for client wrappers */
export interface Stripe402ClientConfig {
  /** Callback to handle payment when 402 is received */
  onPaymentRequired: OnPaymentRequired
  /** Optional: pre-existing client ID to include in requests */
  clientId?: string
}

// --- Error Types ---

export type PaymentErrorCode =
  | 'payment_required'
  | 'card_declined'
  | 'insufficient_credits'
  | 'payment_failed'
  | 'invalid_payment'
  | 'top_up_below_minimum'
