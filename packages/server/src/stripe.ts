import Stripe from 'stripe'

export class StripeService {
  private readonly stripe: Stripe

  constructor(secretKey: string) {
    this.stripe = new Stripe(secretKey)
  }

  /**
   * Create and immediately confirm a PaymentIntent.
   * Returns the confirmed PaymentIntent.
   */
  async createAndConfirmPayment(params: {
    amount: number
    currency: string
    paymentMethodId: string
    customerId?: string
    description?: string
  }): Promise<Stripe.PaymentIntent> {
    return this.stripe.paymentIntents.create({
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
    })
  }

  /**
   * Retrieve the card fingerprint from a PaymentMethod.
   * Stripe's fingerprint is consistent per card number across a Stripe account.
   */
  async getCardFingerprint(paymentMethodId: string): Promise<string> {
    const pm = await this.stripe.paymentMethods.retrieve(paymentMethodId)

    if (!pm.card?.fingerprint) {
      throw new Error(
        `PaymentMethod ${paymentMethodId} does not have a card fingerprint`
      )
    }

    return pm.card.fingerprint
  }

  /**
   * Find or create a Stripe Customer keyed by a metadata field
   * so the same card fingerprint always maps to the same customer.
   */
  async findOrCreateCustomer(
    clientId: string,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    // Search for existing customer by metadata
    const existing = await this.stripe.customers.search({
      query: `metadata["stripe402_client_id"]:"${clientId}"`,
    })

    if (existing.data.length > 0) {
      return existing.data[0]
    }

    // Create new customer and attach the payment method
    const customer = await this.stripe.customers.create({
      payment_method: paymentMethodId,
      metadata: { stripe402_client_id: clientId },
    })

    return customer
  }
}
