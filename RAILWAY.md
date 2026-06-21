# Railway Deployment Guide

This document covers everything needed to deploy, maintain, and update the AI Wargames monorepo on Railway.

---

## Architecture

The project deploys as **four Railway services** in a single project:

| Service | What it does | Port |
|---------|-------------|------|
| `web` | Next.js frontend + REST API | 3000 |
| `worker` | Socket.IO realtime + BullMQ turn timers | 3001 |
| `Postgres` | PostgreSQL database (Railway plugin) | internal |
| `Redis` | Redis cache/queue (Railway plugin) | internal |

---

## First-Time Setup

### 1. Create the Railway project

- Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**
- Select this repo. Railway will detect `railway.toml` and create `web` and `worker` services.

### 2. Add plugins

In the Railway project dashboard, click **+ New** and add:
- **PostgreSQL** plugin
- **Redis** plugin

### 3. Wire up environment variables

Railway plugins don't auto-connect to services. You must add variable references manually.

For **both** `web` and `worker` services, go to their **Variables** tab and add:

```
DATABASE_URL   = ${{Postgres.DATABASE_URL}}
REDIS_URL      = ${{Redis.REDIS_URL}}
```

Use Railway's reference syntax (`${{ServiceName.VAR}}`) so the internal hostnames are used — these are faster, free, and not exposed to the internet.

For the **web** service only:
```
PORT                  = 3000
NEXT_PUBLIC_WS_URL    = https://<worker-domain>.up.railway.app
ANTHROPIC_API_KEY     = <your key>
ADMIN_PASSWORD        = <strong password>
```

For the **worker** service only:
```
PORT          = 3001
CORS_ORIGIN   = https://<web-domain>.up.railway.app
ANTHROPIC_API_KEY = <your key>
```

### 4. Generate public domains

For **both** `web` and `worker` services:
- Service → **Settings** → **Networking** → **Generate Domain**
- When asked which port: **3000** for web, **3001** for worker

The worker needs a public domain because the browser connects to it directly via Socket.IO.

> **Chicken-and-egg note:** You need the worker's domain to set `NEXT_PUBLIC_WS_URL` on the web service, which is baked in at Next.js build time. Deploy the worker first, get its domain, then set the variable on web and let it redeploy.

### 5. Push the database schema

The Postgres database starts empty — you must create the tables once. Run this from your local machine using the **public** Postgres URL (not the internal one):

```bash
# Get DATABASE_PUBLIC_URL from Railway → Postgres service → Variables tab
DATABASE_URL=postgresql://postgres:password@roundhouse.proxy.rlwy.net:PORT/railway pnpm db:push
```

You only ever need to do this when the schema changes. Redis needs no migration — it fills up automatically.

---

## Ongoing Deployments

Railway auto-deploys both services on every push to `main`:

```bash
git add -A && git commit -m "your message" && git push
```

No manual steps needed unless the database schema changes (see below).

---

## Schema Changes

If you modify anything in `packages/db/src/schema.ts`, run a migration after pushing:

```bash
DATABASE_URL=<public postgres URL> pnpm db:push
```

---

## Known Railway Quirks

### `railway.toml` `[[services]]` format is partially ignored
Railway reads the `[[services]]` array for service names and start commands, but **ignores `buildCommand`**. Nixpacks auto-detects the build command as `pnpm --filter <package> build`. This is why:
- Each app has a `prebuild` script that builds workspace dependencies first
- The `build` script in `apps/web/package.json` explicitly sets `NODE_ENV=production`

### Railway injects a non-standard `NODE_ENV` during build
Railway's build environment sets `NODE_ENV` to a non-standard value (not `"production"`, `"development"`, or `"test"`). This causes React to load its development bundle, which has stricter checks that break the Next.js `/500` page prerender. The fix is already in place: the web `build` script forces `NODE_ENV=production next build`.

### Internal vs public database URLs
- `DATABASE_URL` / `REDIS_URL` — internal hostnames (e.g. `postgres.railway.internal`). Only reachable from within Railway's network. Use these in service environment variables.
- `DATABASE_PUBLIC_URL` / `REDIS_PUBLIC_URL` — publicly accessible. Use these only for one-off local commands like `pnpm db:push`.

### Next.js 15 + Pages Router error pages
The project uses App Router but needs `pages/_error.tsx`, `pages/_document.tsx`, and `pages/500.tsx` to prevent Next.js from using its default error page renderer (which imports `<Html>` in a way that breaks under non-standard `NODE_ENV`).

---

## Environment Variable Reference

| Variable | Service | Description |
|----------|---------|-------------|
| `DATABASE_URL` | web, worker | PostgreSQL connection (internal Railway URL) |
| `REDIS_URL` | web, worker | Redis connection (internal Railway URL) |
| `PORT` | web (`3000`), worker (`3001`) | Port the service listens on |
| `NEXT_PUBLIC_WS_URL` | web | Worker's public domain, e.g. `https://worker-xxx.up.railway.app` |
| `CORS_ORIGIN` | worker | Web service's public domain, e.g. `https://web-xxx.up.railway.app` |
| `ANTHROPIC_API_KEY` | web, worker | Anthropic API key for AI adjudication |
| `ADMIN_PASSWORD` | web | Password for the admin panel (defaults to `"admin"` if unset) |
| `DEFAULT_TURN_DURATION_SECONDS` | web, worker | Turn length in seconds (default: `90`) |
| `MODEL_ADJUDICATOR` | web, worker | Anthropic model for adjudication (default: `claude-sonnet-4-6`) |
| `NODE_ENV` | — | Do not set manually — already forced to `production` in build scripts |

---

## Adding New Scenarios

Scenarios live in `scenarios/<name>/` as JSON files (`map.json`, `scenario.json`, `wiki.json`). They are included in the Railway build automatically since they are tracked in git. No Railway config changes are needed — just push the new scenario files.
