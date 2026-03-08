# Agentic Payments

stripe402 is designed for AI agents to autonomously discover and pay for APIs without human intervention.

## The Problem

Today, when an AI agent discovers a useful API, it typically can't use it without:

1. A human creating an account
2. Generating API keys
3. Configuring billing
4. Providing the keys to the agent

This breaks autonomous workflows and requires human-in-the-loop for every new API.

## How stripe402 Solves This

With stripe402, an agent can:

1. **Discover** an API endpoint
2. **Receive** pricing information in a machine-readable 402 response
3. **Pay** with a pre-authorized card (via a stored PaymentMethod ID)
4. **Use** the resource immediately
5. **Continue** making requests against its credit balance

No human in the loop. No account provisioning. The agent treats payment as just another HTTP header.

## Implementation

### All You Need: Card Details

An agent **does not need a Stripe account**. The only prerequisite is a credit card (number, expiration, CVC). When a stripe402 API responds with 402, the response includes the server's **publishable key** — the agent uses that key to tokenize its card on the fly.

### Complete Agent Setup

```ts
import Stripe from 'stripe'
import { createStripe402Fetch } from '@stripe402/client-fetch'

// The agent's card — the only thing it needs
const AGENT_CARD = {
  number: '4242424242424242',  // Test card (use a real card in production)
  exp_month: 12,
  exp_year: 2034,
  cvc: '123',
}

const agentFetch = createStripe402Fetch({
  onPaymentRequired: async (requirements) => {
    // Optional: check spending budget before approving
    const budgetRemaining = await checkBudget()

    if (requirements.minTopUp > budgetRemaining) {
      return null // Over budget, decline
    }

    // Use the PUBLISHABLE key from the 402 response — no Stripe account needed
    const stripe = new Stripe(requirements.publishableKey)
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: AGENT_CARD,
    })

    return {
      paymentMethodId: pm.id,
      topUpAmount: requirements.minTopUp,
    }
  },
})

// Agent uses APIs normally — payment is transparent
const weather = await agentFetch('https://weather-api.example.com/forecast')
const translation = await agentFetch('https://translate-api.example.com/en-to-fr', {
  method: 'POST',
  body: JSON.stringify({ text: 'Hello world' }),
})
```

### Budget Controls

Agents should have spending policies:

```ts
import Stripe from 'stripe'

let cachedPmId: string | null = null

const onPaymentRequired = async (requirements) => {
  // Check per-request cost
  if (requirements.amount > MAX_COST_PER_REQUEST) {
    console.log(`Request too expensive: ${requirements.amount} units`)
    return null
  }

  // Check total spending
  const spent = await getTotalSpent()
  if (spent + requirements.minTopUp > DAILY_BUDGET) {
    console.log('Daily budget exceeded')
    return null
  }

  // Tokenize card (cache the result for reuse)
  if (!cachedPmId) {
    const stripe = new Stripe(requirements.publishableKey)
    const pm = await stripe.paymentMethods.create({
      type: 'card',
      card: AGENT_CARD,
    })
    cachedPmId = pm.id
  }

  // Approve payment
  await recordSpending(requirements.minTopUp)
  return {
    paymentMethodId: cachedPmId,
    topUpAmount: requirements.minTopUp,
  }
}
```

## Why This Works

### Self-Describing Protocol

The 402 response is fully machine-readable:

```json
{
  "stripe402Version": 1,
  "resource": { "url": "/api/weather" },
  "accepts": [{
    "scheme": "stripe",
    "currency": "usd",
    "amount": 500,
    "minTopUp": 50000,
    "publishableKey": "pk_test_...",
    "description": "Weather data"
  }]
}
```

An agent can parse this to understand: what the API does, how much it costs, what the minimum payment is, and how to pay.

### Credit Persistence

After the first payment, the agent receives a `clientId` and uses credits for subsequent requests — no repeated payments, just a lightweight header on each request.

### Cross-API Portability

The same credit card works with any stripe402-enabled API. An agent with one card can pay for APIs across different providers, each with their own pricing. Each provider's publishable key creates a separate PaymentMethod, but the agent only ever needs its card details.

## Security Considerations

- **Store card details securely** — treat them like secrets (environment variables, encrypted config)
- **Implement spending limits** — agents should have daily/monthly budgets
- **Monitor usage** — track which APIs the agent is paying for and how much
- **Use Stripe test mode** during development — test keys don't charge real cards
- **PCI scope** — agents handling raw card numbers are in SAQ-D scope; card details go directly to Stripe, never to the API server
- **Cache PaymentMethod IDs** — once created, the `pm_...` ID can be reused for subsequent top-ups on the same server, avoiding repeated card tokenization

See [Creating Payment Methods](creating-payment-methods.md) for all options including caching strategies.
