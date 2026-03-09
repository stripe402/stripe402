import 'dotenv/config'
import Stripe from 'stripe'

/**
 * Creates a Stripe PaymentMethod using the SERVER'S publishable key and test card details.
 *
 * This simulates what a real client would do: use the publishable key
 * (which they'd get from a 402 response) to tokenize a card.
 * No Stripe account is needed on the client side — the publishable key
 * belongs to the server.
 *
 * Usage:
 *   pnpm create-pm                                              # Visa test card (default)
 *   pnpm create-pm 5555555555554444                             # Mastercard test card
 *   pnpm create-pm 4242424242424242 12 2034 123                 # Custom card details
 *
 * Common test card numbers (see https://docs.stripe.com/testing#cards):
 *   4242424242424242   - Visa
 *   5555555555554444   - Mastercard
 *   378282246310005    - American Express
 *   6011111111111117   - Discover
 *   4000000000000002   - Always declines
 */
async function main() {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY
  if (!publishableKey) {
    console.error('Error: STRIPE_PUBLISHABLE_KEY is not set.')
    console.error('Add it to apps/example/.env or export it as an environment variable.')
    console.error('')
    console.error('This is the publishable key (pk_test_...), NOT the secret key.')
    console.error('In a real stripe402 flow, clients get this from the 402 response automatically.')
    process.exit(1)
  }

  if (!publishableKey.startsWith('pk_test_')) {
    console.error('Error: STRIPE_PUBLISHABLE_KEY must be a test key (pk_test_...) for safety.')
    process.exit(1)
  }

  // Parse card details from args, or use Visa test card defaults
  const cardNumber = process.argv[2] ?? '4242424242424242'
  const expMonth = parseInt(process.argv[3] ?? '12', 10)
  const expYear = parseInt(process.argv[4] ?? '2034', 10)
  const cvc = process.argv[5] ?? '123'

  // Use the PUBLISHABLE key — this is what clients do.
  // They never need a Stripe secret key or a Stripe account.
  const stripe = new Stripe(publishableKey)

  try {
    const paymentMethod = await stripe.paymentMethods.create({
      type: 'card',
      card: {
        number: cardNumber,
        exp_month: expMonth,
        exp_year: expYear,
        cvc,
      },
    })

    console.log(`PaymentMethod created successfully!\n`)
    console.log(`  ID:       ${paymentMethod.id}`)
    console.log(`  Brand:    ${paymentMethod.card?.brand}`)
    console.log(`  Last 4:   ${paymentMethod.card?.last4}`)
    console.log(`  Expires:  ${paymentMethod.card?.exp_month}/${paymentMethod.card?.exp_year}`)
    console.log(`\nAdd to your .env file:`)
    console.log(`  TEST_PAYMENT_METHOD_ID=${paymentMethod.id}`)
    console.log(`\nOr use directly in code:`)
    console.log(`  paymentMethodId: '${paymentMethod.id}'`)
    console.log(`\nNote: This used the PUBLISHABLE key (${publishableKey.slice(0, 12)}...) — no secret key needed.`)
    console.log(`In a real stripe402 flow, clients get this key automatically from the 402 response.`)
  } catch (err: any) {
    console.error(`Failed to create PaymentMethod: ${err.message}`)
    if (err.message?.includes('unsupported for publishable key tokenization')) {
      console.error('')
      console.error('You need to enable "Publishable key card tokenization" in your Stripe dashboard:')
      console.error('  1. Go to https://dashboard.stripe.com/settings/integration')
      console.error('  2. Enable "Publishable key card tokenization"')
      console.error('  3. Save and retry this command')
      console.error('')
      console.error('This is required for headless/programmatic card tokenization (AI agents, CLI tools).')
      console.error('Card details are sent directly to Stripe, never to the API server, so this is safe.')
    }
    process.exit(1)
  }
}

main()
