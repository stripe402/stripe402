import 'dotenv/config'
import axios from 'axios'
import { createStripe402Axios } from '@stripe402/client-axios'
import { unitsToDollars } from '@stripe402/core'

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000'

/**
 * Demo: Axios client that auto-handles stripe402 payment flows.
 *
 * In a real app, onPaymentRequired would prompt the user for card details
 * and tokenize via Stripe.js. Here we use a test payment method ID.
 */
async function main() {
  const client = createStripe402Axios(axios.create({ baseURL: BASE_URL }), {
    onPaymentRequired: async (requirements) => {
      console.log(`\n💳 Payment required!`)
      console.log(`   Cost per request: $${unitsToDollars(requirements.amount)}`)
      console.log(`   Minimum top-up: $${unitsToDollars(requirements.minTopUp)}`)
      console.log(`   Description: ${requirements.description}`)

      // In production, you would:
      // 1. Use Stripe.js to tokenize a card → PaymentMethod ID
      // 2. Return it here
      //
      // For testing with Stripe test mode, you'd create a PaymentMethod first:
      //   const stripe = require('stripe')(PUBLISHABLE_KEY)
      //   const pm = await stripe.paymentMethods.create({ type: 'card', card: { token: 'tok_visa' } })
      //   return { paymentMethodId: pm.id, topUpAmount: requirements.minTopUp }

      const testPaymentMethodId = process.env.TEST_PAYMENT_METHOD_ID
      if (!testPaymentMethodId) {
        console.log('   Set TEST_PAYMENT_METHOD_ID env var to test payments.')
        return null
      }

      return {
        paymentMethodId: testPaymentMethodId,
        topUpAmount: requirements.minTopUp,
      }
    },
  })

  // 1. Free endpoint — should work without payment
  console.log('--- Hitting free endpoint ---')
  const health = await client.get('/api/health')
  console.log('Health:', health.data)

  // 2. Paid endpoint — will trigger 402 → payment → retry
  console.log('\n--- Hitting paid endpoint ---')
  try {
    const joke = await client.get('/api/joke')
    console.log('Joke:', joke.data)
  } catch (err: any) {
    if (err.response?.status === 402) {
      console.log('Payment required but no payment method configured.')
      console.log('Set TEST_PAYMENT_METHOD_ID to test the full flow.')
    } else {
      throw err
    }
  }
}

main().catch(console.error)
