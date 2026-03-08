# Building & Scripts

## Root Scripts

Run these from the repository root:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start all packages in development/watch mode |
| `pnpm build` | Build all packages (runs `tsc` in each) |
| `pnpm typecheck` | Type-check all packages without emitting files (`tsc --noEmit`) |
| `pnpm test` | Run all tests with Vitest |
| `pnpm test:coverage` | Run tests with V8 coverage reporting |
| `pnpm clean` | Remove `dist/` directories from all packages |

All root scripts use `pnpm -r` to run the command recursively across all workspace packages.

## Per-Package Scripts

Each package has these scripts:

| Command | Description |
|---------|-------------|
| `pnpm build` | Compile TypeScript to `dist/` via `tsc` |
| `pnpm typecheck` | Type-check without emitting (`tsc --noEmit`) |
| `pnpm clean` | Remove `dist/` directory (`rm -rf dist`) |

## Example App Scripts

The `apps/example` package has additional scripts:

| Command | Description |
|---------|-------------|
| `pnpm dev` | Run the example server with `ts-node` |
| `pnpm build` | Compile TypeScript |
| `pnpm start` | Run the compiled server (`node dist/server.js`) |
| `pnpm demo:axios` | Run the Axios client demo |
| `pnpm demo:fetch` | Run the Fetch client demo |

## Build Output

Each package compiles from `src/` to `dist/`:

```
packages/core/
├── src/
│   ├── types.ts
│   ├── constants.ts
│   ├── headers.ts
│   ├── identity.ts
│   ├── errors.ts
│   └── index.ts
└── dist/
    ├── types.js          # Compiled JavaScript
    ├── types.d.ts        # Type declarations
    ├── types.d.ts.map    # Declaration source maps
    ├── types.js.map      # JavaScript source maps
    ├── ...
    └── index.js
```

## Development Workflow

```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm build

# 3. Start development (watches for changes)
pnpm dev

# 4. Run tests
pnpm test

# 5. Type-check before committing
pnpm typecheck

# 6. Clean and rebuild
pnpm clean && pnpm build
```

## No Build Orchestrator

stripe402 does not use Turborepo, Nx, or any build orchestrator. pnpm's built-in workspace support handles:

- **Dependency resolution**: `workspace:*` protocol
- **Build ordering**: `pnpm -r build` respects inter-package dependencies
- **Script execution**: `pnpm -r` runs commands across all packages

This keeps the tooling simple — there's no additional configuration to maintain.
