# Creating Payment Methods

stripe402 clients **do not need a Stripe account**. The only thing a client needs is a credit card.

When a server responds with 402, it includes its own Stripe **publishable key** in the response. The client uses that key to tokenize their card into a PaymentMethod ID (`pm_...`) — the card details go directly to Stripe, never to the API server. The client then sends just the `pm_...` ID back to the server.

## How It Works

```
1. Client hits paid endpoint
2. Server responds 402 with publishableKey: "pk_test_..."
3. Client uses that key to tokenize their card with Stripe → gets pm_...
4. Client retries the request with pm_...
5. Server charges the card and serves the resource
```

The publishable key is available inside the `onPaymentRequired` callback as `requirements.publishableKey`.

---

## Stripe Dashboard Requirement: Publishable Key Tokenization

Before clients can create PaymentMethods using raw card details (Methods 1, 3, and the `create-pm` script), the **server operator** must enable a Stripe dashboard setting:

1. Go to [Stripe Dashboard → Settings → Integration](https://dashboard.stripe.com/settings/integration)
2. Find **"Publishable key card tokenization"** (under "Advanced card tokenization controls" or similar)
3. Enable the toggle to allow creating PaymentMethods with a publishable key without Stripe's prebuilt UI elements
4. Save the setting

Without this, direct card tokenization via the API will fail with:

```
This integration surface is unsupported for publishable key tokenization.
```

### Why stripe402 requires this

Stripe disables this by default because most web apps should use Stripe Elements or Checkout for card collection, which provides PCI-compliant UI components. However, stripe402 is designed for **programmatic, machine-to-machine payments** — there is no browser UI for an AI agent or CLI tool to interact with.

### Why this is safe

- **Card details go directly to Stripe's servers** — the API server never sees raw card numbers. The publishable key creates a tokenized `pm_...` reference, and only that token is sent to the API server.
- **Publishable keys are designed to be public** — they can only create tokens, not charge cards or read account data.
- **The setting only affects tokenization on the server operator's own Stripe account** — each server operator controls their own toggle.
- **Browser clients using Stripe.js Elements are unaffected** — this setting is only needed for headless/API-based tokenization (Method 2 below works without it).

> **Note for server operators**: This setting applies to your Stripe account. You only need to enable it once, and it covers all stripe402 clients that use your publishable key for headless tokenization.

---

## Method 1: Headless / Node.js Client (Card Details in Code)

For AI agents, server-to-server, or any headless client. Use the Stripe SDK with the **publishable key** from the 402 response and your card details:

```ts
import Stripe from 'stripe'
import { createStripe402Fetch } from '@stripe402/client-fetch'

const MY_CARD = {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2034,
  cvc: '123',
}

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    // Use the PUBLISHABLE key from the 402 response — no Stripe account needed
    const stripe = new Stripe(requirements.publishableKey)

    // Tokenize your card — card details go to Stripe, not to the API server
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: MY_CARD,
    })

    return {
      paymentMethodId: pm.id,
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Use any stripe402 API — payment is automatic
const response = await fetchWithPayment('https://api.example.com/api/weather')
const data = await response.json()
```

Key points:
- `requirements.publishableKey` comes from the 402 response — the server provides it
- The Stripe SDK sends card details directly to Stripe's servers, not to the API server
- The client only sends the resulting `pm_...` ID to the API server
- **No Stripe account or secret key is needed on the client side**

### With Axios

```ts
import Stripe from 'stripe'
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'

const MY_CARD = {
  number: '4242424242424242',
  exp_month: 12,
  exp_year: 2034,
  cvc: '123',
}

const client = createStripe402Axios(axios.create(), {
  onPaymentRequired: async (requirements) => {
    const stripe = new Stripe(requirements.publishableKey)
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: MY_CARD,
    })
    return { paymentMethodId: pm.id, topUpAmount: requirements.minTopUp }
  },
})

const response = await client.get('https://api.example.com/api/weather')
```

### Caching the PaymentMethod

You can create the PaymentMethod once and reuse the `pm_...` ID. Once cached, subsequent 402 responses skip the Stripe call:

```ts
let cachedPmId: string | null = null

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    if (!cachedPmId) {
      const stripe = new Stripe(requirements.publishableKey)
      const pm = await stripe.paymentMethods.create({
        type: 'card',
        card: MY_CARD,
      })
      cachedPmId = pm.id
    }
    return { paymentMethodId: cachedPmId, topUpAmount: requirements.minTopUp }
  },
})
```

Note: The cached `pm_...` ID is tied to the server's Stripe account (since it was created with the server's publishable key). If you're calling multiple stripe402 APIs on different Stripe accounts, each will produce a different `pm_...` ID.

### PCI Compliance Note

Handling raw card numbers in code (even when sending them directly to Stripe) technically puts you in **PCI SAQ-D** scope. For automated systems and AI agents, this is often acceptable because:
- Card details go directly to Stripe, never to the API server
- The API server only sees the tokenized `pm_...` ID
- The agent's environment should be secured regardless

For user-facing applications, use Stripe.js in the browser instead (see below).

---

## Method 2: Browser Client (Stripe.js)

For web applications where end users enter their own card details. This is the most secure approach — card data is handled entirely by Stripe's hosted iframe, never touching your code (SAQ-A compliance).

### Setup

```html
<div id="card-element"></div>
<button id="pay-button">Pay</button>

<script src="https://js.stripe.com/v3/"></script>
```

Or with npm:

```bash
pnpm add @stripe/stripe-js
```

### Complete Browser Example

```ts
import { loadStripe, type Stripe as StripeJS } from '@stripe/stripe-js'
import { createStripe402Fetch } from '@stripe402/client-fetch'

let stripeInstance: StripeJS | null = null
let cardElement: any = null

async function initCard(publishableKey: string) {
  if (stripeInstance) return
  stripeInstance = await loadStripe(publishableKey)
  if (!stripeInstance) throw new Error('Failed to load Stripe.js')
  const elements = stripeInstance.elements()
  cardElement = elements.create('card')
  cardElement.mount('#card-element')
}

const fetchWithPayment = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    // Use the publishable key from the 402 response
    await initCard(requirements.publishableKey)

    // Show the card form, wait for user to click pay
    const confirmed = await showPaymentDialog(requirements)
    if (!confirmed) return null

    // Tokenize — card data stays in Stripe's iframe, never in your code
    const { paymentMethod, error } = await stripeInstance!.createPaymentMethod({
      type: 'card',
      card: cardElement,
    })

    if (error || !paymentMethod) return null

    return {
      paymentMethodId: paymentMethod.id,
      topUpAmount: requirements.minTopUp,
    }
  },
})
```

The key insight: `requirements.publishableKey` is the server's key, provided automatically in the 402 response. The client never needs their own Stripe account.

---

## Method 3: Utility Script (for Testing)

The example app includes a script that creates a PaymentMethod from test card details. It uses the **publishable key** (not the secret key):

```bash
cd apps/example

# Create a Visa test PaymentMethod
pnpm create-pm

# Create a Mastercard
pnpm create-pm 5555555555554444

# Custom card details: number exp_month exp_year cvc
pnpm create-pm 4242424242424242 12 2034 123
```

Output:

```
PaymentMethod created successfully!

  ID:       pm_1RFxyz...
  Brand:    visa
  Last 4:   4242
  Expires:  12/2034

Add to your .env file:
  TEST_PAYMENT_METHOD_ID=pm_1RFxyz...
```

The script requires `STRIPE_PUBLISHABLE_KEY` in your `.env` file (the `pk_test_...` key, not the secret key).

### Common Test Card Numbers

| Number | Brand | Notes |
|--------|-------|-------|
| `4242424242424242` | Visa | Default test card |
| `5555555555554444` | Mastercard | |
| `378282246310005` | Amex | |
| `6011111111111117` | Discover | |
| `4000000000000002` | Always declines | For testing error handling |

Full list: [Stripe Testing Documentation](https://docs.stripe.com/testing#cards)

---

## Method 4: Stripe CLI (for Server Operators)

Server operators (who have Stripe accounts) can also create test PaymentMethods via the CLI:

```bash
stripe paymentmethods create --type=card -d card[token]=tok_visa
```

This uses test tokens and requires a Stripe account login. **This is for server-side testing only** — clients never need the Stripe CLI.

---

## Summary

| Who | What they need | How they create a PaymentMethod |
|-----|---------------|-------------------------------|
| **Browser user** | Credit card | Stripe.js Elements + publishable key from 402 response |
| **AI agent / headless client** | Credit card details | Stripe SDK + publishable key from 402 response |
| **Server operator (testing)** | Stripe account | CLI, SDK with secret key, or utility script |

The critical design point: **clients never need a Stripe account**. The server's publishable key — provided in every 402 response — is all they need to tokenize a card.

## PaymentMethod Lifecycle

Once created, a PaymentMethod ID (`pm_...`) is:

- **Reusable**: The same ID can be sent on every request — the server only charges when the balance is insufficient
- **Persistent**: Valid until the underlying card expires
- **Server-scoped**: Tied to the server's Stripe account (the publishable key used to create it)
- **Not a card number**: A tokenized reference — safe to store, transmit, and log

### Safe to Reuse on Every Request

Clients can send the same `paymentMethodId` on every request without worrying about being charged multiple times. The server derives a `clientId` from the card's fingerprint and checks for existing credits before charging:

- **Credits sufficient**: deducts from balance, no charge created
- **Credits insufficient**: charges the card for a new top-up, then deducts

This means simple clients (like shell scripts using `curl`) can use the same `payment` header repeatedly. The card is only charged when the balance actually runs out. For optimal performance, clients should switch to sending just the `clientId` (from the `payment-response` header) after the first request, which avoids the Stripe API call to look up the card fingerprint on every request.
