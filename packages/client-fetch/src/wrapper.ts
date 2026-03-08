import {
  HEADERS,
  decodeHeader,
  encodeHeader,
  type PaymentRequiredResponse,
  type PaymentPayload,
  type PaymentResponse,
  type Stripe402ClientConfig,
  STRIPE402_VERSION,
} from '@stripe402/core'

/**
 * Wraps the global fetch to automatically handle stripe402 payment flows.
 *
 * Usage:
 * ```ts
 * const fetchWithPayment = createStripe402Fetch({
 *   onPaymentRequired: async (requirements) => {
 *     return { paymentMethodId: 'pm_...', topUpAmount: 1000 }
 *   },
 * })
 * const res = await fetchWithPayment('https://api.example.com/paid-endpoint')
 * ```
 */
export function createStripe402Fetch(
  config: Stripe402ClientConfig,
  baseFetch: typeof fetch = globalThis.fetch
): typeof fetch {
  let storedClientId = config.clientId ?? null

  const wrappedFetch: typeof fetch = async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    const response = await baseFetch(input, init)

    if (response.status !== 402) {
      // Extract client ID from successful payment responses
      const paymentResponseHeader = response.headers.get(HEADERS.PAYMENT_RESPONSE)
      if (paymentResponseHeader) {
        try {
          const paymentResponse = decodeHeader<PaymentResponse>(paymentResponseHeader)
          if (paymentResponse.clientId) {
            storedClientId = paymentResponse.clientId
          }
        } catch {
          // Ignore malformed headers
        }
      }
      return response
    }

    // Check if this is already a retry (prevent infinite loops)
    const existingHeaders = init?.headers as Record<string, string> | undefined
    if (existingHeaders?.[HEADERS.PAYMENT]) {
      return response
    }

    // Decode the 402 payment requirements
    const paymentRequiredHeader = response.headers.get(HEADERS.PAYMENT_REQUIRED)
    if (!paymentRequiredHeader) {
      return response
    }

    let paymentRequired: PaymentRequiredResponse
    try {
      paymentRequired = decodeHeader<PaymentRequiredResponse>(paymentRequiredHeader)
    } catch {
      return response
    }

    const requirements = paymentRequired.accepts[0]
    if (!requirements) {
      return response
    }

    // First try: if we have a client ID and not already rejected for insufficient credits
    if (storedClientId && paymentRequired.error !== 'insufficient_credits') {
      const payload: PaymentPayload = {
        stripe402Version: STRIPE402_VERSION,
        clientId: storedClientId,
      }

      const retryHeaders: Record<string, string> = {
        ...(existingHeaders ?? {}),
        [HEADERS.PAYMENT]: encodeHeader(payload),
      }

      const retryResponse = await baseFetch(input, { ...init, headers: retryHeaders })

      // If retry succeeded, extract client ID and return
      if (retryResponse.status !== 402) {
        const prHeader = retryResponse.headers.get(HEADERS.PAYMENT_RESPONSE)
        if (prHeader) {
          try {
            const pr = decodeHeader<PaymentResponse>(prHeader)
            if (pr.clientId) storedClientId = pr.clientId
          } catch {
            // Ignore
          }
        }
        return retryResponse
      }

      // If retry also returned 402 (insufficient credits), fall through to payment
    }

    // Need payment — call the user's callback
    const paymentInfo = await config.onPaymentRequired(requirements)
    if (!paymentInfo) {
      return response // User declined to pay
    }

    const payload: PaymentPayload = {
      stripe402Version: STRIPE402_VERSION,
      paymentMethodId: paymentInfo.paymentMethodId,
      clientId: storedClientId ?? undefined,
      topUpAmount: paymentInfo.topUpAmount,
    }

    const retryHeaders: Record<string, string> = {
      ...(existingHeaders ?? {}),
      [HEADERS.PAYMENT]: encodeHeader(payload),
    }

    const finalResponse = await baseFetch(input, { ...init, headers: retryHeaders })

    // Extract client ID from the final response
    const prHeader = finalResponse.headers.get(HEADERS.PAYMENT_RESPONSE)
    if (prHeader) {
      try {
        const pr = decodeHeader<PaymentResponse>(prHeader)
        if (pr.clientId) storedClientId = pr.clientId
      } catch {
        // Ignore
      }
    }

    return finalResponse
  }

  return wrappedFetch
}
