'use client'

import { useState } from 'react'

/* ─── Icons ─── */

function GitHubIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  )
}

function ArrowRight({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.333 8h9.334M8.667 4l4 4-4 4" />
    </svg>
  )
}

/* ─── Shared ─── */

const GITHUB_URL = 'https://github.com/whatl3y/stripe402'
const TWITTER_URL = 'https://x.com/stripe402'

function SocialLinks({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-5 ${className}`}>
      <a
        href={GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-tertiary hover:text-text-primary transition-colors duration-200"
        aria-label="GitHub"
      >
        <GitHubIcon />
      </a>
      <a
        href={TWITTER_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="text-text-tertiary hover:text-text-primary transition-colors duration-200"
        aria-label="X (Twitter)"
      >
        <XIcon />
      </a>
    </div>
  )
}

/* ─── FAQ ─── */

function FAQ({ question, children }: { question: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-6 text-left cursor-pointer group"
      >
        <span className="text-[17px] font-medium text-text-primary group-hover:text-stripe-purple transition-colors duration-200">
          {question}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className={`text-text-quaternary flex-shrink-0 ml-8 transition-transform duration-200 ${open ? 'rotate-45' : ''}`}
        >
          <path d="M7 1v12M1 7h12" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${open ? 'max-h-96 pb-6' : 'max-h-0'}`}
      >
        <div className="text-[15px] text-text-secondary leading-[1.7] max-w-[640px]">
          {children}
        </div>
      </div>
    </div>
  )
}

/* ─── Syntax Highlight Spans ─── */

function Line({ children, kw, fn, str, num, cmt, prop, txt }: {
  children: React.ReactNode
  kw?: boolean
  fn?: boolean
  str?: boolean
  num?: boolean
  cmt?: boolean
  prop?: boolean
  txt?: boolean
}) {
  let color = 'text-text-secondary'
  if (kw) color = 'text-[#FF7B72]'
  if (fn) color = 'text-[#D2A8FF]'
  if (str) color = 'text-[#A5D6FF]'
  if (num) color = 'text-[#79C0FF]'
  if (cmt) color = 'text-text-quaternary'
  if (prop) color = 'text-[#FFA657]'
  if (txt) color = 'text-text-secondary'
  return <span className={color}>{children}</span>
}

/* ─── Comparison Row ─── */

function ComparisonCell({ text, sentiment, highlighted }: { text: string; sentiment: string; highlighted?: boolean }) {
  const sentimentDot = sentiment === 'positive'
    ? 'bg-stripe-teal'
    : sentiment === 'negative'
      ? 'bg-stripe-orange'
      : 'bg-text-quaternary'

  return (
    <div className={`px-5 py-4 flex items-center gap-3 ${highlighted ? 'bg-stripe-purple/[0.04]' : 'bg-surface-raised'}`}>
      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${sentimentDot}`} />
      <span className={`text-[14px] leading-[1.5] ${highlighted ? 'text-text-primary' : 'text-text-secondary'}`}>
        {text}
      </span>
    </div>
  )
}

function ComparisonRow({ label, trad, x402, s402 }: {
  label: string
  trad: { text: string; sentiment: string }
  x402: { text: string; sentiment: string }
  s402: { text: string; sentiment: string }
}) {
  return (
    <>
      <div className="bg-surface-raised px-5 py-4 flex items-center">
        <span className="text-[13px] font-medium text-text-tertiary">{label}</span>
      </div>
      <ComparisonCell {...trad} />
      <ComparisonCell {...x402} />
      <ComparisonCell {...s402} highlighted />
    </>
  )
}

/* ─── Section Header ─── */

function SectionHeader({
  label,
  title,
  description,
}: {
  label: string
  title: string
  description?: string
}) {
  return (
    <div className="max-w-[600px]">
      <p className="text-[12px] font-mono text-stripe-purple tracking-[0.08em] uppercase mb-4">
        {label}
      </p>
      <h2
        className="text-[36px] md:text-[42px] font-bold tracking-[-0.03em] leading-[1.1] text-text-primary"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {description && (
        <p className="mt-5 text-[17px] text-text-secondary leading-[1.65]">
          {description}
        </p>
      )}
    </div>
  )
}

/* ─── Page ─── */

export default function Home() {
  return (
    <div className="min-h-screen bg-navy-950">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 bg-navy-950/90 backdrop-blur-md border-b border-border-subtle">
        <div className="max-w-[1080px] mx-auto px-6 h-[60px] flex items-center justify-between">
          <a href="#" className="flex items-center gap-0.5">
            <span className="text-[17px] font-semibold tracking-[-0.01em] text-text-primary">
              stripe<span className="text-stripe-purple">402</span>
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7">
            {['How It Works', 'Comparison', 'Packages', 'FAQ'].map((label) => (
              <a
                key={label}
                href={`#${label.toLowerCase().replace(/\s+/g, '-')}`}
                className="text-[14px] text-text-tertiary hover:text-text-primary transition-colors duration-200"
              >
                {label}
              </a>
            ))}
          </nav>

          <SocialLinks />
        </div>
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative pt-[140px] pb-[100px]">
          <div className="hero-gradient" />
          <div className="max-w-[1080px] mx-auto px-6 relative z-10">
            <div className="max-w-[680px]">
              <p className="text-[13px] font-mono font-medium text-stripe-purple tracking-[0.08em] uppercase mb-5">
                Agentic Payments Made Easy
              </p>
              <h1 className="text-[52px] md:text-[64px] font-bold tracking-[-0.035em] leading-[1.05] text-text-primary mb-6">
                Payment is the
                <br />
                authentication.
              </h1>
              <p className="text-[19px] text-text-secondary leading-[1.65] mb-10 max-w-[540px]">
                An open standard for API &amp; agentic payments using HTTP 402 and Stripe.
                No signup. No API keys. No OAuth. Just pay and use —
                AI agents pay for APIs on their first request,
                no human in the loop.
              </p>
              <div className="flex items-center gap-4">
                <a
                  href={GITHUB_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 px-5 py-2.5 rounded-lg bg-stripe-purple text-white text-[15px] font-medium hover:bg-stripe-purple-light transition-colors duration-200"
                >
                  Get started
                  <ArrowRight />
                </a>
                <a
                  href="#how-it-works"
                  className="inline-flex items-center gap-2 text-[15px] font-medium text-text-secondary hover:text-text-primary transition-colors duration-200"
                >
                  How it works
                  <ArrowRight />
                </a>
              </div>
            </div>

            {/* Code preview */}
            <div className="mt-16 max-w-[560px]">
              <div className="rounded-lg bg-surface-raised border border-border-default overflow-hidden">
                <div className="px-4 py-2.5 border-b border-border-default flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-navy-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-navy-700" />
                    <div className="w-2.5 h-2.5 rounded-full bg-navy-700" />
                  </div>
                  <span className="text-[12px] font-mono text-text-quaternary ml-2">server.ts</span>
                </div>
                <pre className="px-5 py-4 text-[13px] font-mono leading-[1.7] overflow-x-auto">
                  <code>
                    <Line kw>import</Line>
                    <Line txt>{' { paymentRequired } '}</Line>
                    <Line kw>from </Line>
                    <Line str>{`'@stripe402/express'`}</Line>
                    {'\n\n'}
                    <Line cmt>{'// One middleware. $0.01 per request.'}</Line>
                    {'\n'}
                    <Line txt>{'app.'}</Line>
                    <Line fn>use</Line>
                    <Line txt>{'('}</Line>
                    <Line str>{"'/api/weather'"}</Line>
                    <Line txt>{', '}</Line>
                    <Line fn>paymentRequired</Line>
                    <Line txt>{'({ '}</Line>
                    <Line prop>price</Line>
                    <Line txt>{': '}</Line>
                    <Line num>100</Line>
                    <Line txt>{' })'}</Line>
                    <Line txt>{')'}</Line>
                  </code>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── What is stripe402 ── */}
        <section className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Overview"
              title="The 402 status code, finally&nbsp;realized."
              description="Reserved since 1997 for 'Payment Required' but never standardized. stripe402 puts it to work — a machine-readable payment protocol between clients and servers, powered by credit cards."
            />

            <div className="grid md:grid-cols-3 gap-px bg-border-subtle rounded-xl overflow-hidden mt-14">
              {[
                {
                  title: 'Zero signup',
                  body: 'No registration, no API keys, no OAuth. Identity is derived from the card fingerprint via HMAC — same card always produces the same identity.',
                },
                {
                  title: 'Credit card rails',
                  body: 'Built on Stripe and the payment infrastructure 99% of the internet already uses. No crypto wallets, no stablecoins, no bridging.',
                },
                {
                  title: 'Agent-native',
                  body: 'Pre-authorize a card and let your AI agent pay for any API on its first request. No human-in-the-loop needed for provisioning.',
                },
              ].map((item) => (
                <div key={item.title} className="bg-surface-raised p-8">
                  <h3 className="text-[17px] font-semibold text-text-primary mb-3 tracking-[-0.01em]">
                    {item.title}
                  </h3>
                  <p className="text-[15px] text-text-tertiary leading-[1.65]">
                    {item.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── How It Works ── */}
        <section id="how-it-works" className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Protocol"
              title="Five steps. Fully&nbsp;automatic."
              description="After the first payment, subsequent requests re-use the client ID until the balance runs out."
            />

            <div className="mt-14 grid gap-0">
              {[
                {
                  step: '1',
                  title: 'Client requests a paid resource',
                  http: 'GET /api/weather HTTP/1.1',
                },
                {
                  step: '2',
                  title: 'Server responds 402 with payment details',
                  http: 'HTTP/1.1 402 Payment Required\npayment-required: eyJwcmljZSI6MTAwLCJtaW5Ub3BVcCI6NTAwMDAuLi59',
                },
                {
                  step: '3',
                  title: 'Client tokenizes card via Stripe and retries',
                  http: 'GET /api/weather HTTP/1.1\npayment: eyJwYXltZW50TWV0aG9kSWQiOiJwbV8uLi4iLCJ0b3BVcCI6NTAwMDB9',
                },
                {
                  step: '4',
                  title: 'Server charges card, returns client ID and balance',
                  http: 'HTTP/1.1 200 OK\npayment-response: eyJjbGllbnRJZCI6ImM4YTJlLi4uIiwiY3JlZGl0c1JlbWFpbmluZyI6NDk5MDB9',
                },
                {
                  step: '5',
                  title: 'Subsequent requests include the client ID',
                  http: 'GET /api/weather HTTP/1.1\npayment: eyJjbGllbnRJZCI6ImM4YTJlLi4uIn0=',
                },
              ].map((item, i) => (
                <div key={item.step} className="flex gap-6 group">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full border-2 border-stripe-purple bg-navy-950 flex items-center justify-center text-[13px] font-mono font-semibold text-stripe-purple flex-shrink-0">
                      {item.step}
                    </div>
                    {i < 4 && (
                      <div className="w-px flex-1 bg-border-default" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-10 flex-1 min-w-0">
                    <h3 className="text-[16px] font-semibold text-text-primary mb-3 tracking-[-0.01em]">
                      {item.title}
                    </h3>
                    <div className="rounded-lg bg-surface-raised border border-border-default overflow-hidden">
                      <pre className="px-4 py-3 text-[12px] font-mono text-text-secondary leading-[1.8] overflow-x-auto">
                        {item.http}
                      </pre>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Credits ── */}
        <section className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Micropayments"
              title="Sub-cent pricing, without the&nbsp;fee&nbsp;problem."
              description="Stripe charges $0.30 + 2.9% per transaction with a $0.50 minimum. stripe402 batches charges into credit top-ups, making per-request pricing at fractions of a cent economically viable."
            />

            <div className="grid md:grid-cols-2 gap-6 mt-14">
              <div className="rounded-xl bg-surface-raised border border-border-default p-7">
                <h3 className="text-[15px] font-semibold text-text-primary mb-5 tracking-[-0.01em]">
                  Credits system
                </h3>
                <dl className="space-y-4">
                  {[
                    ['Unit', '1/10,000 of a dollar (1 basis point)'],
                    ['Example', '100 units = $0.01 per request'],
                    ['Top-up', '$5.00 = 50,000 units = 500 requests at $0.01'],
                    ['Storage', 'Redis (Lua atomics) or PostgreSQL (WHERE clause)'],
                  ].map(([term, def]) => (
                    <div key={term} className="flex gap-3 text-[14px]">
                      <dt className="text-text-quaternary w-[72px] flex-shrink-0 font-mono text-[12px] pt-px">
                        {term}
                      </dt>
                      <dd className="text-text-secondary leading-[1.6]">{def}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              <div className="rounded-xl bg-surface-raised border border-border-default p-7">
                <h3 className="text-[15px] font-semibold text-text-primary mb-5 tracking-[-0.01em]">
                  Client identity
                </h3>
                <div className="rounded-lg bg-navy-950 border border-border-default px-4 py-3 mb-5">
                  <code className="text-[12px] font-mono text-stripe-teal">
                    HMAC-SHA256(card_fingerprint, server_secret)
                  </code>
                </div>
                <ul className="space-y-3 text-[14px] text-text-secondary leading-[1.6]">
                  <li>
                    <span className="text-text-primary font-medium">Deterministic</span> — same card on the same server always produces the same ID
                  </li>
                  <li>
                    <span className="text-text-primary font-medium">Private</span> — the card fingerprint cannot be recovered from the client ID
                  </li>
                  <li>
                    <span className="text-text-primary font-medium">Isolated</span> — different servers produce different IDs for the same card
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Comparison ── */}
        <section id="comparison" className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Comparison"
              title="Familiar payment rails, modern&nbsp;protocol."
              description="How stripe402 stacks up against traditional API monetization and crypto-native alternatives."
            />

            {/* Column headers */}
            <div className="mt-14 grid grid-cols-[180px_1fr_1fr_1fr] gap-px rounded-t-xl overflow-hidden">
              <div className="bg-navy-950" />
              <div className="bg-surface-overlay px-5 py-4">
                <p className="text-[11px] font-mono text-text-quaternary uppercase tracking-[0.08em] mb-1">Traditional</p>
                <p className="text-[15px] font-semibold text-text-secondary">API Keys + Billing</p>
              </div>
              <div className="bg-surface-overlay px-5 py-4">
                <p className="text-[11px] font-mono text-text-quaternary uppercase tracking-[0.08em] mb-1">Crypto-native</p>
                <p className="text-[15px] font-semibold text-text-secondary">x402 (USDC)</p>
              </div>
              <div className="bg-stripe-purple/[0.08] border border-stripe-purple/20 px-5 py-4 -ml-px -mt-px rounded-tr-xl">
                <p className="text-[11px] font-mono text-stripe-purple uppercase tracking-[0.08em] mb-1">This project</p>
                <p className="text-[15px] font-semibold text-text-primary">stripe402</p>
              </div>
            </div>

            {/* Rows */}
            <div className="grid grid-cols-[180px_1fr_1fr_1fr] gap-px bg-border-subtle rounded-b-xl overflow-hidden">
              {[
                {
                  label: 'User onboarding',
                  trad: { text: 'Account + API key', sentiment: 'neutral' },
                  x402: { text: 'Crypto wallet + USDC', sentiment: 'negative' },
                  s402: { text: 'None — just a card', sentiment: 'positive' },
                },
                {
                  label: 'Payment rail',
                  trad: { text: 'Invoicing / subscription', sentiment: 'neutral' },
                  x402: { text: 'On-chain stablecoin', sentiment: 'neutral' },
                  s402: { text: 'Stripe (credit cards)', sentiment: 'positive' },
                },
                {
                  label: 'State model',
                  trad: { text: 'Stateful (user DB)', sentiment: 'neutral' },
                  x402: { text: 'Stateless (per-tx)', sentiment: 'positive' },
                  s402: { text: 'Stateful (credits)', sentiment: 'neutral' },
                },
                {
                  label: 'Micropayments',
                  trad: { text: 'Not viable', sentiment: 'negative' },
                  x402: { text: 'Native', sentiment: 'positive' },
                  s402: { text: 'Via credit top-ups', sentiment: 'positive' },
                },
                {
                  label: 'Agent-friendly',
                  trad: { text: 'Manual provisioning', sentiment: 'negative' },
                  x402: { text: 'Wallet signing', sentiment: 'neutral' },
                  s402: { text: 'Pre-authorized card', sentiment: 'positive' },
                },
                {
                  label: 'Regulatory burden',
                  trad: { text: 'Low', sentiment: 'positive' },
                  x402: { text: 'High (crypto)', sentiment: 'negative' },
                  s402: { text: 'Low', sentiment: 'positive' },
                },
                {
                  label: 'Adoption barrier',
                  trad: { text: 'Medium (signup)', sentiment: 'neutral' },
                  x402: { text: 'High (wallet + tokens)', sentiment: 'negative' },
                  s402: { text: 'Low (any card)', sentiment: 'positive' },
                },
              ].map((row) => (
                <ComparisonRow key={row.label} {...row} />
              ))}
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Trade-offs ── */}
        <section className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Trade-offs"
              title="What you should&nbsp;know."
              description="No protocol is perfect. stripe402 optimizes for low adoption friction at the cost of statefulness."
            />

            <div className="mt-14 grid md:grid-cols-2 gap-6">
              <div className="rounded-xl bg-surface-raised border border-border-default p-7">
                <p className="text-[12px] font-mono text-stripe-teal tracking-[0.06em] uppercase mb-5">
                  Strengths
                </p>
                <ul className="space-y-4 text-[14px] text-text-secondary leading-[1.6]">
                  <li>Uses credit cards — the existing payment rail for 99% of the internet</li>
                  <li>Zero adoption barrier for end users</li>
                  <li>Self-describing protocol — the 402 response tells clients exactly what to pay and how</li>
                  <li>AI agents can pay for APIs autonomously on their first request</li>
                  <li>Low regulatory complexity compared to crypto-based alternatives</li>
                </ul>
              </div>

              <div className="rounded-xl bg-surface-raised border border-border-default p-7">
                <p className="text-[12px] font-mono text-stripe-orange tracking-[0.06em] uppercase mb-5">
                  Limitations
                </p>
                <ul className="space-y-4 text-[14px] text-text-secondary leading-[1.6]">
                  <li>
                    <span className="text-text-primary">Stateful</span> — server maintains credit balances (vs. x402&#39;s stateless on-chain settlement)
                  </li>
                  <li>
                    <span className="text-text-primary">3D Secure</span> — EU cards may require interactive authentication, breaking headless flows
                  </li>
                  <li>
                    <span className="text-text-primary">$0.50 minimum charge</span> — top-ups should be $5+ for efficiency
                  </li>
                  <li>
                    <span className="text-text-primary">PCI scope</span> — server-side tokenization requires SAQ-D; browser-based Stripe.js keeps you at SAQ-A
                  </li>
                  <li>
                    <span className="text-text-primary">Single currency</span> — one currency per route (for now)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Packages ── */}
        <section id="packages" className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Packages"
              title="Install only what you&nbsp;need."
            />

            <div className="mt-14 space-y-px rounded-xl overflow-hidden border border-border-default">
              {[
                {
                  name: '@stripe402/core',
                  scope: 'Shared',
                  desc: 'Protocol types, constants, base64 encoding/decoding, HMAC identity derivation, error classes. Zero dependencies.',
                },
                {
                  name: '@stripe402/server',
                  scope: 'Server',
                  desc: 'Stripe integration, payment processing, persistence stores for Redis and PostgreSQL.',
                },
                {
                  name: '@stripe402/express',
                  scope: 'Server',
                  desc: 'Express middleware — add 402 payment gating to any route with a single function call.',
                },
                {
                  name: '@stripe402/client-fetch',
                  scope: 'Client',
                  desc: 'Fetch wrapper that automatically handles 402 responses, tokenizes the card, and caches the client ID.',
                },
                {
                  name: '@stripe402/client-axios',
                  scope: 'Client',
                  desc: 'Axios interceptor that transparently handles 402 responses.',
                },
              ].map((pkg) => (
                <div
                  key={pkg.name}
                  className="bg-surface-raised px-7 py-5 flex flex-col md:flex-row md:items-center gap-2 md:gap-6"
                >
                  <code className="text-[14px] font-mono text-stripe-purple-light w-[240px] flex-shrink-0">
                    {pkg.name}
                  </code>
                  <span className="text-[11px] font-mono text-text-quaternary uppercase tracking-[0.08em] w-[56px] flex-shrink-0">
                    {pkg.scope}
                  </span>
                  <span className="text-[14px] text-text-tertiary leading-[1.5]">
                    {pkg.desc}
                  </span>
                </div>
              ))}
            </div>

            {/* Install */}
            <div className="mt-10 max-w-[480px]">
              <div className="rounded-lg bg-surface-raised border border-border-default overflow-hidden">
                <pre className="px-5 py-4 text-[13px] font-mono leading-[2]">
                  <Line cmt># server</Line>{'\n'}
                  <Line txt>npm install </Line><Line str>@stripe402/express</Line>{'\n'}
                  {'\n'}
                  <Line cmt># client (pick one)</Line>{'\n'}
                  <Line txt>npm install </Line><Line str>@stripe402/client-fetch</Line>{'\n'}
                  <Line txt>npm install </Line><Line str>@stripe402/client-axios</Line>
                </pre>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── Quick Start ── */}
        <section className="py-[100px]">
          <div className="max-w-[1080px] mx-auto px-6">
            <SectionHeader
              label="Quick start"
              title="Running in under a&nbsp;minute."
            />

            <div className="grid lg:grid-cols-2 gap-6 mt-14">
              <div>
                <p className="text-[12px] font-mono text-text-quaternary tracking-[0.06em] uppercase mb-3">Server</p>
                <div className="rounded-lg bg-surface-raised border border-border-default overflow-hidden">
                  <pre className="px-5 py-4 text-[13px] font-mono leading-[1.8] overflow-x-auto">
                    <code>
                      <Line kw>import</Line><Line txt> express </Line><Line kw>from </Line><Line str>{`'express'`}</Line>{'\n'}
                      <Line kw>import</Line><Line txt>{` { paymentRequired } `}</Line><Line kw>from </Line><Line str>{`'@stripe402/express'`}</Line>{'\n'}
                      {'\n'}
                      <Line kw>const</Line><Line txt> app = </Line><Line fn>express</Line><Line txt>()</Line>{'\n'}
                      {'\n'}
                      <Line txt>app.</Line><Line fn>get</Line><Line txt>(</Line><Line str>{"'/api/weather'"}</Line><Line txt>,</Line>{'\n'}
                      <Line txt>{'  '}</Line><Line fn>paymentRequired</Line><Line txt>{'({ '}</Line><Line prop>price</Line><Line txt>{': '}</Line><Line num>100</Line><Line txt>{' }),'}</Line>{'\n'}
                      <Line txt>{'  (req, res) '}</Line><Line kw>={'>'}</Line><Line txt> res.</Line><Line fn>json</Line><Line txt>{'({ temp: 72 })'}</Line>{'\n'}
                      <Line txt>)</Line>
                    </code>
                  </pre>
                </div>
              </div>
              <div>
                <p className="text-[12px] font-mono text-text-quaternary tracking-[0.06em] uppercase mb-3">Client</p>
                <div className="rounded-lg bg-surface-raised border border-border-default overflow-hidden">
                  <pre className="px-5 py-4 text-[13px] font-mono leading-[1.8] overflow-x-auto">
                    <code>
                      <Line kw>import</Line><Line txt>{` { wrapFetch } `}</Line><Line kw>from </Line><Line str>{`'@stripe402/client-fetch'`}</Line>{'\n'}
                      {'\n'}
                      <Line kw>const</Line><Line txt> paidFetch = </Line><Line fn>wrapFetch</Line><Line txt>(fetch, {'{'}</Line>{'\n'}
                      <Line txt>{'  '}</Line><Line prop>paymentMethodId</Line><Line txt>{': '}</Line><Line str>{"'pm_...'"}</Line>{'\n'}
                      <Line txt>{'})'}</Line>{'\n'}
                      {'\n'}
                      <Line kw>const</Line><Line txt> res = </Line><Line kw>await</Line><Line txt> </Line><Line fn>paidFetch</Line><Line txt>(</Line>{'\n'}
                      <Line txt>{'  '}</Line><Line str>{"'https://api.example.com/weather'"}</Line>{'\n'}
                      <Line txt>)</Line>
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </section>

        <hr className="section-rule" />

        {/* ── FAQ ── */}
        <section id="faq" className="py-[100px]">
          <div className="max-w-[680px] mx-auto px-6">
            <SectionHeader label="FAQ" title="Common&nbsp;questions." />

            <div className="mt-14">
              <FAQ question="What's the difference between stripe402 and x402?">
                x402 uses cryptocurrency (USDC on various blockchains) for
                stateless per-request payments. stripe402 uses traditional credit
                cards via Stripe with a credits-based system. The protocol flow
                is similar, but stripe402 requires only a credit card — no crypto
                wallet or stablecoins.
              </FAQ>
              <FAQ question="How does pricing work?">
                Prices are in units where 1 unit = 1/10,000 of a dollar.
                100 units = $0.01, 10,000 units = $1.00. Clients top up their
                balance in larger amounts (recommended $5+) and spend credits
                per-request.
              </FAQ>
              <FAQ question="Is this production-ready?">
                stripe402 is in its early stages. The core protocol and packages
                are functional and tested, but should be evaluated carefully for
                production use. Contributions and feedback are welcome on GitHub.
              </FAQ>
              <FAQ question="What about PCI compliance?">
                Browser-based Stripe.js tokenization keeps you at PCI SAQ-A (22
                requirements). Server-side tokenization requires SAQ-D (300+
                requirements). The recommended path for browser clients is always
                Stripe.js.
              </FAQ>
              <FAQ question="What persistence stores are supported?">
                Redis (using Lua scripts for atomic operations) and PostgreSQL
                (using WHERE clauses for atomic balance deduction). You can also
                implement a custom store via the persistence interface.
              </FAQ>
              <FAQ question="Can AI agents use this?">
                Yes — this is a primary use case. An AI agent pre-authorized with
                a Stripe PaymentMethod ID can autonomously pay for any
                stripe402-enabled API on its first request.
              </FAQ>
              <FAQ question="What about 3D Secure / Strong Customer Authentication?">
                Some EU cards require interactive browser-based 3D Secure
                authentication, which can break headless flows. For fully
                autonomous agent use, cards that don&#39;t require SCA are
                recommended.
              </FAQ>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border-subtle">
        <div className="max-w-[1080px] mx-auto px-6 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-8">
              <span className="text-[15px] font-semibold tracking-[-0.01em] text-text-tertiary">
                stripe<span className="text-stripe-purple">402</span>
              </span>
              <nav className="flex items-center gap-6 text-[13px] text-text-quaternary">
                <a href="#how-it-works" className="hover:text-text-secondary transition-colors duration-200">
                  How It Works
                </a>
                <a href="#comparison" className="hover:text-text-secondary transition-colors duration-200">
                  Comparison
                </a>
                <a href="#packages" className="hover:text-text-secondary transition-colors duration-200">
                  Packages
                </a>
                <a href="#faq" className="hover:text-text-secondary transition-colors duration-200">
                  FAQ
                </a>
              </nav>
            </div>
            <SocialLinks />
          </div>
          <div className="mt-8 pt-6 border-t border-border-subtle">
            <div className="flex flex-col md:flex-row items-center justify-between gap-3 text-[12px] text-text-quaternary leading-[1.7]">
              <p>&copy; {new Date().getFullYear()} stripe402 contributors. Released under the Apache License 2.0.</p>
              <p className="text-center md:text-right max-w-[520px]">
                stripe402 is an independent open-source project and is not affiliated with,
                endorsed by, or sponsored by Stripe, Inc. &ldquo;Stripe&rdquo; is a registered
                trademark of Stripe, Inc.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
