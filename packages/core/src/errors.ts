import type { PaymentErrorCode } from './types'

export class Stripe402Error extends Error {
  public readonly code: PaymentErrorCode

  constructor(code: PaymentErrorCode, message: string) {
    super(message)
    this.name = 'Stripe402Error'
    this.code = code
  }
}
