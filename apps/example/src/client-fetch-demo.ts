import 'dotenv/config'
import { createStripe402Fetch } from '@stripe402/client-fetch'
import { unitsToDollars } from '@stripe402/core'

const BASE_URL = process.env.API_URL ?? 'http://localhost:3000'

/**
 * Demo: Fetch client that auto-handles stripe402 payment flows.
 */
async function main() {
  const fetchWithPayment = createStripe402Fetch({
    onPaymentRequired: async (requirements) => {
      console.log(`\n💳 Payment required!`)
      console.log(`   Cost per request: $${unitsToDollars(requirements.amount)}`)
      console.log(`   Minimum top-up: $${unitsToDollars(requirements.minTopUp)}`)
      console.log(`   Description: ${requirements.description}`)

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

  // 1. Free endpoint
  console.log('--- Hitting free endpoint ---')
  const healthRes = await fetchWithPayment(`${BASE_URL}/api/health`)
  console.log('Health:', await healthRes.json())

  // 2. Paid endpoint
  console.log('\n--- Hitting paid endpoint ---')
  const jokeRes = await fetchWithPayment(`${BASE_URL}/api/joke`)
  if (jokeRes.status === 402) {
    console.log('Payment required but no payment method configured.')
    console.log('Set TEST_PAYMENT_METHOD_ID to test the full flow.')
  } else {
    console.log('Joke:', await jokeRes.json())
  }
}

main().catch(console.error)
