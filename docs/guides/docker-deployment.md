# Docker Deployment

The stripe402 monorepo includes a `docker-compose.yml` for running the full stack locally.

## Services

The Docker Compose file defines four services:

### `redis`

```yaml
redis:
  image: redis:latest
  ports:
    - "6379:6379"
```

Standard Redis server. Used by `RedisStore` for client balance storage.

### `postgres`

```yaml
postgres:
  image: postgres:16
  ports:
    - "5433:5432"
  environment:
    POSTGRES_USER: stripe402
    POSTGRES_PASSWORD: stripe402
    POSTGRES_DB: stripe402
  volumes:
    - pgdata:/var/lib/postgresql/data
```

PostgreSQL 16 with persistent volume. Note the host port is `5433` (not the default `5432`) to avoid conflicts with a local PostgreSQL installation.

| Setting | Value |
|---------|-------|
| Host port | 5433 |
| Container port | 5432 |
| Database | `stripe402` |
| Username | `stripe402` |
| Password | `stripe402` |

Connection URL: `postgresql://stripe402:stripe402@localhost:5433/stripe402`

### `example-server`

```yaml
example-server:
  build:
    context: .
    dockerfile: apps/example/Dockerfile
  ports:
    - "${PORT:-3000}:3000"
  env_file:
    - apps/example/.env
  environment:
    - REDIS_URL=redis://redis:6379
    - DATABASE_URL=postgresql://stripe402:stripe402@postgres:5432/stripe402
    - PORT=3000
  depends_on:
    - redis
    - postgres
```

The example server. Reads environment from `apps/example/.env` and overrides connection URLs to use Docker service names.

The host port is configurable via the `PORT` environment variable (defaults to 3000).

### `website`

```yaml
website:
  build:
    context: .
    dockerfile: apps/website/Dockerfile
  ports:
    - "${WEBSITE_PORT:-4000}:4000"
```

The marketing website (Next.js). Host port configurable via `WEBSITE_PORT` (defaults to 4000).

## Quick Start

```bash
# 1. Create .env file with Stripe keys
cp apps/example/.env.example apps/example/.env
# Edit apps/example/.env with your Stripe test keys

# 2. Start all services
docker compose up -d

# 3. Verify
curl http://localhost:3000/api/health
# => {"status":"ok"}

curl -i http://localhost:3000/api/joke
# => HTTP/1.1 402 Payment Required
```

## Running Individual Services

```bash
# Just Redis (for local development)
docker compose up -d redis

# Redis + PostgreSQL
docker compose up -d redis postgres

# Everything
docker compose up -d
```

## Data Persistence

The `pgdata` named volume persists PostgreSQL data across container restarts:

```yaml
volumes:
  pgdata:
```

Redis data is **not** persisted (no volume mount). When the Redis container is removed, all client balances are lost. For production, add a volume or use a managed Redis service.

## Connecting Locally

When running your server outside Docker but using Docker for infrastructure:

```bash
# Start just the databases
docker compose up -d redis postgres

# In your .env
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://stripe402:stripe402@localhost:5433/stripe402
```

Note: Use `localhost` and the **host** ports (6379, 5433) when connecting from outside Docker.

## Stopping

```bash
# Stop containers (preserves volumes)
docker compose down

# Stop and remove volumes (deletes all data)
docker compose down -v
```
