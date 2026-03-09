import type { Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import {
  HEADERS,
  STRIPE402_VERSION,
  DEFAULT_CURRENCY,
  DEFAULT_MIN_TOP_UP,
  unitsToCents,
  encodeHeader,
  decodeHeader,
  deriveClientId,
  type PaymentRequiredResponse,
  type PaymentPayload,
  type PaymentResponse,
  type Stripe402ServerConfig,
  type RouteConfig,
} from '@stripe402/core'
import { StripeService } from '@stripe402/server'

/**
 * Express middleware factory for stripe402 payment-gated routes.
 *
 * Usage:
 * ```ts
 * app.use(stripe402Middleware({
 *   stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
 *   stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
 *   serverSecret: process.env.SERVER_SECRET!,
 *   store: new RedisStore(redis),
 *   routes: {
 *     'GET /api/weather': { amount: 1, description: 'Weather lookup' },
 *   },
 * }))
 * ```
 */
export function stripe402Middleware(config: Stripe402ServerConfig) {
  const stripeService = new StripeService(config.stripeSecretKey)

  return async (req: Request, res: Response, next: NextFunction) => {
    // Check if this route is a paid route
    const routeKey = `${req.method} ${req.path}`
    const routeConfig = config.routes[routeKey]
    if (!routeConfig) {
      return next()
    }

    const currency = routeConfig.currency ?? DEFAULT_CURRENCY
    const minTopUp = routeConfig.minTopUp ?? DEFAULT_MIN_TOP_UP

    // Check for payment header
    const paymentHeader =
      req.headers[HEADERS.PAYMENT] as string | undefined

    if (!paymentHeader) {
      return send402(res, routeConfig, config.stripePublishableKey, req.path, currency, minTopUp)
    }

    // Decode and process the payment
    let payload: PaymentPayload
    try {
      payload = decodeHeader<PaymentPayload>(paymentHeader)
    } catch {
      return sendPaymentError(res, 'invalid_payment', 'Malformed payment header')
    }

    // Case 1: Client has an existing client ID — try to deduct from balance
    if (payload.clientId) {
      const remaining = await config.store.deductBalance(
        payload.clientId,
        routeConfig.amount
      )

      if (remaining !== null) {
        // Deduction successful — serve the resource
        setPaymentResponseHeader(res, {
          success: true,
          creditsRemaining: remaining,
          clientId: payload.clientId,
        })

        // Record the deduction if store supports it
        if (config.store.recordTransaction) {
          await config.store.recordTransaction({
            id: randomUUID(),
            clientId: payload.clientId,
            type: 'deduction',
            amount: routeConfig.amount,
            resource: routeKey,
            createdAt: new Date(),
          })
        }

        return next()
      }

      // Insufficient balance — if no payment method provided, ask for top-up
      if (!payload.paymentMethodId) {
        return send402(
          res,
          routeConfig,
          config.stripePublishableKey,
          req.path,
          currency,
          minTopUp,
          'insufficient_credits'
        )
      }
    }

    // Case 2: New payment — charge the card and credit the balance
    if (!payload.paymentMethodId) {
      return send402(res, routeConfig, config.stripePublishableKey, req.path, currency, minTopUp)
    }

    const topUpAmount = payload.topUpAmount ?? minTopUp
    if (topUpAmount < minTopUp) {
      return sendPaymentError(
        res,
        'top_up_below_minimum',
        `Top-up amount ${topUpAmount} is below the minimum of ${minTopUp}`
      )
    }

    try {
      // Get card fingerprint and derive client ID
      const fingerprint = await stripeService.getCardFingerprint(
        payload.paymentMethodId
      )
      const clientId = deriveClientId(fingerprint, config.serverSecret)

      // Check if this client already has sufficient credits — skip charging if so
      const existingBalance = await config.store.deductBalance(clientId, routeConfig.amount)
      if (existingBalance !== null) {
        setPaymentResponseHeader(res, {
          success: true,
          creditsRemaining: existingBalance,
          clientId,
        })

        if (config.store.recordTransaction) {
          await config.store.recordTransaction({
            id: randomUUID(),
            clientId,
            type: 'deduction',
            amount: routeConfig.amount,
            resource: routeKey,
            createdAt: new Date(),
          })
        }

        return next()
      }

      // Find or create Stripe customer
      const customer = await stripeService.findOrCreateCustomer(
        clientId,
        payload.paymentMethodId
      )

      // Charge the card (convert units to Stripe cents)
      const paymentIntent = await stripeService.createAndConfirmPayment({
        amount: unitsToCents(topUpAmount),
        currency,
        paymentMethodId: payload.paymentMethodId,
        customerId: customer.id,
        description: `stripe402 top-up for ${routeConfig.description ?? req.path}`,
      })

      if (paymentIntent.status !== 'succeeded') {
        return sendPaymentError(
          res,
          'payment_failed',
          `Payment did not succeed. Status: ${paymentIntent.status}`
        )
      }

      // Ensure client record exists
      const existingClient = await config.store.getClient(clientId)
      if (!existingClient) {
        await config.store.createClient({
          clientId,
          stripeCustomerId: customer.id,
          balance: 0,
          currency,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }

      // Credit the balance
      await config.store.addBalance(clientId, topUpAmount)

      // Record the top-up transaction
      if (config.store.recordTransaction) {
        await config.store.recordTransaction({
          id: randomUUID(),
          clientId,
          type: 'topup',
          amount: topUpAmount,
          stripePaymentIntentId: paymentIntent.id,
          createdAt: new Date(),
        })
      }

      // Now deduct for this request
      const remaining = await config.store.deductBalance(clientId, routeConfig.amount)

      // Record the deduction
      if (config.store.recordTransaction) {
        await config.store.recordTransaction({
          id: randomUUID(),
          clientId,
          type: 'deduction',
          amount: routeConfig.amount,
          resource: routeKey,
          createdAt: new Date(),
        })
      }

      setPaymentResponseHeader(res, {
        success: true,
        chargeId: paymentIntent.id,
        creditsRemaining: remaining ?? 0,
        clientId,
      })

      return next()
    } catch (err: any) {
      // Handle Stripe-specific errors
      if (err.type === 'StripeCardError') {
        return sendPaymentError(res, 'card_declined', err.message)
      }
      return sendPaymentError(
        res,
        'payment_failed',
        err.message ?? 'Payment processing failed'
      )
    }
  }
}

function send402(
  res: Response,
  routeConfig: RouteConfig,
  publishableKey: string,
  url: string,
  currency: string,
  minTopUp: number,
  errorCode?: string
): void {
  const body: PaymentRequiredResponse = {
    stripe402Version: STRIPE402_VERSION,
    resource: { url },
    accepts: [
      {
        scheme: 'stripe',
        currency,
        amount: routeConfig.amount,
        minTopUp,
        publishableKey,
        description: routeConfig.description,
      },
    ],
    error: errorCode,
  }

  res
    .status(402)
    .set(HEADERS.PAYMENT_REQUIRED, encodeHeader(body))
    .json(body)
}

function sendPaymentError(
  res: Response,
  code: string,
  message: string
): void {
  const body: PaymentResponse = {
    success: false,
    creditsRemaining: 0,
    clientId: '',
    error: message,
    errorCode: code as any,
  }

  res.status(402).json(body)
}

function setPaymentResponseHeader(
  res: Response,
  paymentResponse: PaymentResponse
): void {
  res.set(HEADERS.PAYMENT_RESPONSE, encodeHeader(paymentResponse))
}
