/**
 * Encode/decode payment headers as base64 JSON (matching x402 pattern).
 */

/** Encode an object as a base64 JSON string for use in HTTP headers */
export function encodeHeader<T>(data: T): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

/** Decode a base64 JSON header string back to an object */
export function decodeHeader<T>(header: string): T {
  const json = Buffer.from(header, 'base64').toString('utf-8')
  return JSON.parse(json) as T
}
