# Agentic Payments

AI agents can discover and pay for stripe402 APIs without human intervention.

## The problem

Today, when an AI agent discovers a useful API, it can't use it without a human creating an account, generating API keys, configuring billing, and providing the keys to the agent. That breaks autonomous workflows.

## How stripe402 works for agents

With stripe402, an agent can:

1. Discover an API endpoint
2. Read pricing from the machine-readable 402 response
3. Pay with a pre-authorized card (via a stored PaymentMethod ID)
4. Use the resource immediately
5. Keep making requests against its credit balance

No human in the loop. The agent treats payment as just another HTTP header.

## Implementation

### All you need: card details

An agent **does not need a Stripe account**. The only prerequisite is a credit card (number, expiration, CVC). When a stripe402 API responds with 402, the response includes the server's **publishable key** — the agent uses that key to tokenize its card on the fly.

### Complete agent setup

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

### Budget controls

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

## How the protocol helps agents

The 402 response is machine-readable, so agents can parse it without any prior knowledge of the API:

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

After the first payment, the agent receives a `clientId` and uses credits for subsequent requests. No repeated charges, just a lightweight header on each request.

The same credit card works with any stripe402-enabled API. Each provider's publishable key creates a separate PaymentMethod, but the agent only ever needs its card details.

## Security considerations

- Store card details securely (environment variables, encrypted config)
- Set spending limits — agents should have daily/monthly budgets
- Monitor usage: which APIs the agent is paying for and how much
- Use Stripe test mode during development
- PCI scope: agents handling raw card numbers are in SAQ-D scope; card details go directly to Stripe, never to the API server
- Cache PaymentMethod IDs — the `pm_...` ID can be reused for subsequent top-ups on the same server

See [Creating Payment Methods](creating-payment-methods.md) for all options including caching strategies.
