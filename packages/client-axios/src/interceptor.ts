import type { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios'
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

const RETRY_FLAG = '_stripe402Retry'

/**
 * Wraps an Axios instance to automatically handle stripe402 payment flows.
 *
 * When a 402 response is received:
 * 1. If the client has a stored clientId, retries with just the clientId (use existing credits)
 * 2. If credits are insufficient, calls onPaymentRequired to get a payment method
 * 3. Retries the original request with the payment header
 *
 * Usage:
 * ```ts
 * const client = createStripe402Axios(axios.create(), {
 *   onPaymentRequired: async (requirements) => {
 *     // Prompt user or use stored card
 *     return { paymentMethodId: 'pm_...', topUpAmount: 1000 }
 *   },
 * })
 * const res = await client.get('https://api.example.com/paid-endpoint')
 * ```
 */
export function createStripe402Axios(
  instance: AxiosInstance,
  config: Stripe402ClientConfig
): AxiosInstance {
  let storedClientId = config.clientId ?? null

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      // Extract client ID from successful payment responses
      const paymentResponseHeader = response.headers[HEADERS.PAYMENT_RESPONSE]
      if (paymentResponseHeader) {
        try {
          const paymentResponse = decodeHeader<PaymentResponse>(paymentResponseHeader)
          if (paymentResponse.clientId) {
            storedClientId = paymentResponse.clientId
          }
        } catch {
          // Ignore malformed headers on success responses
        }
      }
      return response
    },
    async (error) => {
      const response: AxiosResponse | undefined = error.response
      if (!response || response.status !== 402) {
        throw error
      }

      const originalConfig = error.config as InternalAxiosRequestConfig & {
        [RETRY_FLAG]?: boolean
      }

      // Prevent infinite retry loops
      if (originalConfig[RETRY_FLAG]) {
        throw error
      }
      originalConfig[RETRY_FLAG] = true

      // Decode the 402 payment requirements
      const paymentRequiredHeader = response.headers[HEADERS.PAYMENT_REQUIRED]
      if (!paymentRequiredHeader) {
        throw error
      }

      let paymentRequired: PaymentRequiredResponse
      try {
        paymentRequired = decodeHeader<PaymentRequiredResponse>(paymentRequiredHeader)
      } catch {
        throw error
      }

      const requirements = paymentRequired.accepts[0]
      if (!requirements) {
        throw error
      }

      // First try: if we have a client ID, retry with just that (use existing credits)
      if (storedClientId && paymentRequired.error !== 'insufficient_credits') {
        const payload: PaymentPayload = {
          stripe402Version: STRIPE402_VERSION,
          clientId: storedClientId,
        }
        originalConfig.headers[HEADERS.PAYMENT] = encodeHeader(payload)
        return instance.request(originalConfig)
      }

      // Need payment — call the user's callback
      const paymentInfo = await config.onPaymentRequired(requirements)
      if (!paymentInfo) {
        throw error // User declined to pay
      }

      const payload: PaymentPayload = {
        stripe402Version: STRIPE402_VERSION,
        paymentMethodId: paymentInfo.paymentMethodId,
        clientId: storedClientId ?? undefined,
        topUpAmount: paymentInfo.topUpAmount,
      }

      originalConfig.headers[HEADERS.PAYMENT] = encodeHeader(payload)
      return instance.request(originalConfig)
    }
  )

  return instance
}

/**
 * Get the currently stored client ID.
 * Useful for persisting across sessions.
 */
export function getStoredClientId(instance: AxiosInstance): string | null {
  // The client ID is stored in the interceptor closure.
  // For external access, users should track it via the onPaymentRequired callback
  // or by reading the PAYMENT-RESPONSE header from responses.
  return null
}
