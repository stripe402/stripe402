FROM node:22-slim AS build

RUN corepack enable && corepack prepare pnpm@10.28.1 --activate

WORKDIR /app

# Copy workspace root files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./

# Copy website source
COPY apps/website/ apps/website/

# Install dependencies
RUN pnpm install --frozen-lockfile --filter @stripe402/website

# Build static site
RUN cd apps/website && pnpm build

# Serve with a lightweight static server
FROM node:22-slim AS runtime

RUN npm install -g serve@14

COPY --from=build /app/apps/website/out /app/out

EXPOSE 4000

CMD ["serve", "-s", "/app/out", "-l", "4000"]
