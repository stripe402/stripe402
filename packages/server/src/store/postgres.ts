import type { Pool, PoolClient } from 'pg'
import type { ClientRecord, Stripe402Store, TransactionRecord } from '@stripe402/core'

export class PostgresStore implements Stripe402Store {
  constructor(private readonly pool: Pool) {}

  /**
   * Create the required tables if they don't exist.
   * Call this once on startup.
   */
  async createTables(): Promise<void> {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS stripe402_clients (
        client_id TEXT PRIMARY KEY,
        stripe_customer_id TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'usd',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS stripe402_transactions (
        id TEXT PRIMARY KEY,
        client_id TEXT NOT NULL REFERENCES stripe402_clients(client_id),
        type TEXT NOT NULL CHECK (type IN ('topup', 'deduction')),
        amount INTEGER NOT NULL,
        stripe_payment_intent_id TEXT,
        resource TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_stripe402_transactions_client_id
        ON stripe402_transactions(client_id);
    `)
  }

  async getClient(clientId: string): Promise<ClientRecord | null> {
    const result = await this.pool.query(
      'SELECT * FROM stripe402_clients WHERE client_id = $1',
      [clientId]
    )

    if (result.rows.length === 0) return null

    const row = result.rows[0]
    return {
      clientId: row.client_id,
      stripeCustomerId: row.stripe_customer_id,
      balance: row.balance,
      currency: row.currency,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }
  }

  async createClient(record: ClientRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO stripe402_clients (client_id, stripe_customer_id, balance, currency, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (client_id) DO NOTHING`,
      [
        record.clientId,
        record.stripeCustomerId,
        record.balance,
        record.currency,
        record.createdAt,
        record.updatedAt,
      ]
    )
  }

  async deductBalance(clientId: string, amount: number): Promise<number | null> {
    const result = await this.pool.query(
      `UPDATE stripe402_clients
       SET balance = balance - $1, updated_at = NOW()
       WHERE client_id = $2 AND balance >= $1
       RETURNING balance`,
      [amount, clientId]
    )

    if (result.rows.length === 0) return null
    return result.rows[0].balance
  }

  async addBalance(clientId: string, amount: number): Promise<number> {
    const result = await this.pool.query(
      `UPDATE stripe402_clients
       SET balance = balance + $1, updated_at = NOW()
       WHERE client_id = $2
       RETURNING balance`,
      [amount, clientId]
    )

    return result.rows[0].balance
  }

  async recordTransaction(transaction: TransactionRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO stripe402_transactions (id, client_id, type, amount, stripe_payment_intent_id, resource, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        transaction.id,
        transaction.clientId,
        transaction.type,
        transaction.amount,
        transaction.stripePaymentIntentId ?? null,
        transaction.resource ?? null,
        transaction.createdAt,
      ]
    )
  }
}
