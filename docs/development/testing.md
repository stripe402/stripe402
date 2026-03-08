# Testing

stripe402 uses **Vitest** for testing with **V8** for code coverage.

## Configuration

From `vitest.config.ts` at the repository root:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary'],
      include: [
        'packages/*/src/**/*.ts',
        'apps/*/src/**/*.ts',
      ],
      exclude: [
        '**/*.spec.ts',
        '**/*.test.ts',
        '**/index.ts',
        'apps/example/**',
      ],
    },
  },
})
```

| Setting | Value | Description |
|---------|-------|-------------|
| `globals` | `true` | `describe`, `it`, `expect`, `vi` available without imports |
| `coverage.provider` | `'v8'` | Uses V8's built-in coverage instrumentation |
| `coverage.reporter` | `['text', 'text-summary']` | Console-based coverage output |
| `coverage.include` | `packages/*/src/**/*.ts`, `apps/*/src/**/*.ts` | Source files to measure |
| `coverage.exclude` | Test files, barrel exports, example app | Files excluded from coverage |

## Running Tests

```bash
# Run all tests
pnpm test

# Run tests with coverage
pnpm test:coverage

# Run tests for a specific package
cd packages/core && pnpm test

# Run a specific test file
pnpm test packages/core/src/headers.spec.ts

# Watch mode
pnpm test -- --watch
```

## Test Files

Tests are co-located with source files using the `.spec.ts` suffix:

| Package | Test Files | Coverage |
|---------|------------|----------|
| `@stripe402/core` | `constants.spec.ts`, `headers.spec.ts`, `identity.spec.ts`, `errors.spec.ts` | Types, constants, encoding, identity, errors |
| `@stripe402/server` | `stripe.spec.ts`, `store/redis.spec.ts`, `store/postgres.spec.ts` | Stripe integration, Redis store, PostgreSQL store |
| `@stripe402/express` | `middleware.spec.ts` | All middleware code paths |
| `@stripe402/client-axios` | `interceptor.spec.ts` | Axios interceptor behavior |
| `@stripe402/client-fetch` | `wrapper.spec.ts` | Fetch wrapper behavior |

## Mocking Patterns

### Mocking External Dependencies

Tests mock Stripe, Redis, and PostgreSQL using Vitest's `vi.mock()`:

```ts
// Mock the @stripe402/server module
vi.mock('@stripe402/server', () => ({
  StripeService: vi.fn().mockImplementation(() => ({
    getCardFingerprint: vi.fn().mockResolvedValue('fp_test'),
    createAndConfirmPayment: vi.fn().mockResolvedValue({ id: 'pi_test', status: 'succeeded' }),
    findOrCreateCustomer: vi.fn().mockResolvedValue({ id: 'cus_test' }),
  })),
}))
```

### Mocking the Store

```ts
const mockStore = {
  getClient: vi.fn(),
  createClient: vi.fn(),
  deductBalance: vi.fn(),
  addBalance: vi.fn(),
  recordTransaction: vi.fn(),
}
```

### Testing 402 Flows

Client tests simulate 402 responses and verify retry behavior:

```ts
// Simulate a 402 response followed by a 200
const mockFetch = vi.fn()
  .mockResolvedValueOnce(new Response(null, { status: 402, headers: { 'payment-required': encoded402 } }))
  .mockResolvedValueOnce(new Response('{"data":"ok"}', { status: 200, headers: { 'payment-response': encoded200 } }))
```

## Coverage

Coverage excludes:
- **Test files** (`*.spec.ts`, `*.test.ts`)
- **Barrel exports** (`index.ts`) — they only re-export
- **Example app** (`apps/example/**`) — demo code, not library code
