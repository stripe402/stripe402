import { createHmac } from 'crypto'

/**
 * Derive a deterministic client ID from a Stripe card fingerprint and a server secret.
 *
 * Uses HMAC-SHA256 so:
 * - Same card on the same server always produces the same client ID
 * - The card fingerprint cannot be recovered from the client ID
 * - Different servers produce different client IDs for the same card
 */
export function deriveClientId(
  cardFingerprint: string,
  serverSecret: string
): string {
  return createHmac('sha256', serverSecret)
    .update(cardFingerprint)
    .digest('hex')
}
