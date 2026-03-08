# Monorepo Structure

stripe402 uses **pnpm workspaces** to manage a multi-package monorepo.

## Layout

```
stripe402/
├── packages/                 # Publishable npm packages
│   ├── core/                 # @stripe402/core
│   ├── server/               # @stripe402/server
│   ├── express/              # @stripe402/express
│   ├── client-axios/         # @stripe402/client-axios
│   └── client-fetch/         # @stripe402/client-fetch
├── apps/                     # Runnable applications (not published)
│   ├── example/              # Demo server + client scripts
│   └── website/              # Marketing site (Next.js)
├── package.json              # Root workspace config
├── pnpm-workspace.yaml       # Workspace definition
├── tsconfig.base.json        # Shared TypeScript config
├── vitest.config.ts          # Test configuration
├── docker-compose.yml        # Development infrastructure
└── .dockerignore
```

**Convention**: Everything in `packages/` is a publishable npm package. Everything in `apps/` is a private application that is not published.

## Workspace Configuration

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
onlyBuiltDependencies:
  - esbuild
```

- `packages` defines which directories contain workspace members
- `onlyBuiltDependencies` limits native addon builds to only `esbuild` (a dependency of the website's Next.js build)

### Inter-Package Dependencies

Packages reference each other using the `workspace:*` protocol:

```json
{
  "dependencies": {
    "@stripe402/core": "workspace:*"
  }
}
```

This resolves to the local workspace version during development and is replaced with the actual version number during `pnpm publish`.

## TypeScript Configuration

### `tsconfig.base.json` (Root)

Shared compiler options extended by all packages:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node"
  }
}
```

| Option | Value | Why |
|--------|-------|-----|
| `target` | `ES2022` | Modern JavaScript features (top-level await, etc.) |
| `module` | `commonjs` | Broad compatibility with Node.js ecosystem |
| `declaration` | `true` | Generates `.d.ts` type definition files |
| `declarationMap` | `true` | Enables "Go to Definition" in IDEs across packages |
| `sourceMap` | `true` | Debugging support |
| `strict` | `true` | Full strict mode (strictNullChecks, noImplicitAny, etc.) |
| `moduleResolution` | `node` | Standard Node.js module resolution |

### Per-Package `tsconfig.json`

Each package extends the base config:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

## Package Entry Points

All packages follow the same structure:

```json
{
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "files": ["dist"]
}
```

- `main` — CommonJS entry point
- `types` — TypeScript type definitions
- `files` — only the `dist/` directory is published to npm

## Build Order

pnpm handles the build order based on inter-package dependencies:

1. `@stripe402/core` (no deps — builds first)
2. `@stripe402/server` (depends on core)
3. `@stripe402/client-axios` (depends on core)
4. `@stripe402/client-fetch` (depends on core)
5. `@stripe402/express` (depends on core + server)

Running `pnpm -r build` from the root builds all packages in the correct order.
