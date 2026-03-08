# StripeService

A wrapper around the Stripe Node.js SDK that provides the three Stripe operations needed by stripe402.

## Constructor

```ts
new StripeService(secretKey: string)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `secretKey` | `string` | Stripe secret key (`sk_test_...` or `sk_live_...`). |

Creates an internal `Stripe` instance using the provided secret key.

## Methods

### `createAndConfirmPayment(params)`

Create and immediately confirm a Stripe PaymentIntent.

```ts
async createAndConfirmPayment(params: {
  amount: number
  currency: string
  paymentMethodId: string
  customerId?: string
  description?: string
}): Promise<Stripe.PaymentIntent>
```

#### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | `number` | Yes | Amount in **Stripe cents** (not units). Use `unitsToCents()` to convert. |
| `currency` | `string` | Yes | ISO 4217 currency code (e.g., `'usd'`). |
| `paymentMethodId` | `string` | Yes | Stripe PaymentMethod ID (`pm_...`). |
| `customerId` | `string` | No | Stripe Customer ID (`cus_...`). |
| `description` | `string` | No | Charge description shown in the Stripe Dashboard. |

#### Returns

`Promise<Stripe.PaymentIntent>` — The confirmed PaymentIntent. Check `paymentIntent.status === 'succeeded'` to verify success.

#### Stripe API Call

Internally calls `stripe.paymentIntents.create()` with:

```ts
{
  amount: params.amount,
  currency: params.currency,
  payment_method: params.paymentMethodId,
  customer: params.customerId,
  confirm: true,
  automatic_payment_methods: {
    enabled: true,
    allow_redirects: 'never',
  },
  description: params.description,
}
```

Key options:
- `confirm: true` — creates and confirms in one API call
- `automatic_payment_methods.enabled: true` — uses Stripe's automatic payment method detection
- `allow_redirects: 'never'` — prevents redirect-based payment methods (e.g., 3D Secure). This is necessary for machine-to-machine flows where there is no browser to redirect.

---

### `getCardFingerprint(paymentMethodId)`

Retrieve the card fingerprint from a Stripe PaymentMethod.

```ts
async getCardFingerprint(paymentMethodId: string): Promise<string>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `paymentMethodId` | `string` | Stripe PaymentMethod ID (`pm_...`). |

#### Returns

`Promise<string>` — The card fingerprint string. This is consistent per card number within a Stripe account.

#### Throws

`Error` — If the PaymentMethod does not have a card fingerprint (e.g., it's not a card-type PaymentMethod).

#### Stripe API Call

Calls `stripe.paymentMethods.retrieve(paymentMethodId)` and returns `pm.card.fingerprint`.

---

### `findOrCreateCustomer(clientId, paymentMethodId)`

Find an existing Stripe Customer by client ID, or create a new one.

```ts
async findOrCreateCustomer(
  clientId: string,
  paymentMethodId: string
): Promise<Stripe.Customer>
```

#### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `clientId` | `string` | The HMAC-derived client identifier. |
| `paymentMethodId` | `string` | Stripe PaymentMethod ID to attach to a new customer. |

#### Returns

`Promise<Stripe.Customer>` — The existing or newly created Stripe Customer.

#### Behavior

1. **Search**: Calls `stripe.customers.search()` with query `metadata["stripe402_client_id"]:"${clientId}"`
2. **If found**: Returns the first matching customer
3. **If not found**: Creates a new customer with:
   - `payment_method: paymentMethodId` — attaches the card
   - `metadata: { stripe402_client_id: clientId }` — for future lookups

The `stripe402_client_id` metadata field links Stripe Customers to stripe402 client IDs.
