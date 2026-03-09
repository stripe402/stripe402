# Comparison: stripe402 vs x402

Coinbase's [x402](https://x402.org) protocol showed that HTTP-native, machine-readable payment negotiation works. stripe402 brings the same pattern to credit cards.

## Feature comparison

| Feature | x402 (crypto) | stripe402 |
|---------|---------------|-----------|
| **Payment rail** | USDC on Base/Solana | Credit cards via Stripe |
| **Client needs** | Crypto wallet + stablecoins | A credit card |
| **Server needs** | Wallet address | Stripe account |
| **Micropayments** | Native (sub-cent, on-chain) | Via credits system ($5+ top-ups) |
| **Stateless** | Yes (each payment settled on-chain) | No (server tracks balances) |
| **Adoption barrier** | High (wallet setup, fund management) | **Low** (everyone has a credit card) |
| **Regulatory complexity** | High (crypto regulations vary by jurisdiction) | **Low** (credit cards are well-understood) |
| **Settlement speed** | Seconds (on-chain confirmation) | Instant (Stripe confirms synchronously) |
| **Transaction fees** | Gas fees (variable) | Stripe fees (~2.9% + $0.30) |
| **Chargeback risk** | None (crypto is irreversible) | Yes (credit card chargebacks apply) |
| **Protocol header** | `X-PAYMENT` | `payment` / `payment-required` / `payment-response` |

## The statefulness trade-off

The fundamental difference is **statefulness**:

- **x402 is stateless**: Each payment is settled on-chain in the request. The server doesn't need to track anything — the blockchain is the ledger. This is elegant but requires clients to have crypto wallets.

- **stripe402 is stateful**: The server maintains credit balances in Redis or PostgreSQL. This adds complexity (persistence, atomic operations, balance management) but uses credit cards — the payment method available to everyone.

This is a deliberate trade-off. Maintaining a balance ledger is a well-understood problem with well-understood solutions (Redis with Lua for atomicity, PostgreSQL with WHERE clauses). The operational cost of managing state is low compared to the adoption benefit of accepting credit cards.

## What problem does stripe402 solve?

Today, API monetization requires one of:

- API key provisioning with billing dashboards (Stripe Billing, AWS Marketplace)
- OAuth + subscription tiers with account management
- Crypto wallets (x402)

All require signup, account creation, or specialized infrastructure.

stripe402 skips all of that. A client with a credit card can pay for any stripe402-enabled API on the first request. The 402 response tells the client what the resource costs and how to pay.

## When to use which

**Use x402 when**:
- Your clients already have crypto wallets
- You want truly stateless, per-request settlement
- You need irreversible payments (no chargebacks)
- You're building in the crypto ecosystem

**Use stripe402 when**:
- You want the widest possible adoption (credit cards)
- Your clients are traditional web users or AI agents without wallets
- You're comfortable managing server-side state
- You want to use existing Stripe infrastructure
- Chargebacks are an acceptable trade-off for adoption
