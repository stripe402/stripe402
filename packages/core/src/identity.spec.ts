import { describe, it, expect } from 'vitest'
import { createHmac } from 'crypto'
import { deriveClientId } from './identity'

describe('deriveClientId', () => {
  const fingerprint = 'fp_abc123'
  const secret = 'my-server-secret'

  it('should return a hex string', () => {
    const id = deriveClientId(fingerprint, secret)
    expect(id).toMatch(/^[0-9a-f]{64}$/) // SHA-256 produces 64 hex chars
  })

  it('should be deterministic (same inputs produce same output)', () => {
    const id1 = deriveClientId(fingerprint, secret)
    const id2 = deriveClientId(fingerprint, secret)
    expect(id1).toBe(id2)
  })

  it('should produce different IDs for different fingerprints', () => {
    const id1 = deriveClientId('fp_card_1', secret)
    const id2 = deriveClientId('fp_card_2', secret)
    expect(id1).not.toBe(id2)
  })

  it('should produce different IDs for different server secrets', () => {
    const id1 = deriveClientId(fingerprint, 'secret-1')
    const id2 = deriveClientId(fingerprint, 'secret-2')
    expect(id1).not.toBe(id2)
  })

  it('should match manual HMAC-SHA256 computation', () => {
    const expected = createHmac('sha256', secret)
      .update(fingerprint)
      .digest('hex')
    const id = deriveClientId(fingerprint, secret)
    expect(id).toBe(expected)
  })

  it('should handle empty fingerprint', () => {
    const id = deriveClientId('', secret)
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })

  it('should handle empty secret', () => {
    const id = deriveClientId(fingerprint, '')
    expect(id).toMatch(/^[0-9a-f]{64}$/)
  })
})
