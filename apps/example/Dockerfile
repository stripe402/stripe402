FROM node:22-slim AS base

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy all package sources (needed for workspace resolution)
COPY packages/ packages/
COPY apps/example/ apps/example/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build all packages in dependency order
RUN pnpm -r build

WORKDIR /app/apps/example

EXPOSE 3000

CMD ["node", "dist/server.js"]
