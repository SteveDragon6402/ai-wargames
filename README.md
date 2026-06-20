# AI Wargames

A Lord of the Rings themed, turn-based, node-map multiplayer wargame. Two factions — Rohan and Isengard — fight to annihilate each other across a graph of territories. Contested battles are adjudicated by Claude.

## What it is

Players take turns issuing military orders to their units: move to adjacent territories, attack, dig in, cover allies, or disengage. When both players submit (or the turn timer expires), the engine resolves all movement, intercept fire, combat, and morale simultaneously. If units from opposing factions share a node, Claude adjudicates the battle using scenario wiki lore and returns per-unit outcomes with narrative text. Victory goes to the faction that wipes out all enemy units.

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Map | React Flow (`@xyflow/react`) |
| Real-time | Socket.IO 4 |
| Job queue | BullMQ + Redis 7 |
| Database | PostgreSQL 16 + Drizzle ORM |
| AI adjudicator | Anthropic Claude (`@anthropic-ai/sdk`) |
| Monorepo | pnpm workspaces + Turborepo |
| Deployment | Railway |

## Local setup

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker (for Postgres + Redis)

### 1. Start infrastructure

```bash
docker-compose up -d
```

This starts Postgres on port **5433** and Redis on port **6380**.

### 2. Install dependencies

```bash
pnpm install
```

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` — at minimum set:

```
DATABASE_URL=postgres://wargame:wargame@localhost:5433/wargame
REDIS_URL=redis://localhost:6380
```

Add `ANTHROPIC_API_KEY` if you want AI battle adjudication. Without it, battles fall back to deterministic combat math.

### 4. Push the database schema

```bash
pnpm db:push
```

### 5. Run the dev server

```bash
pnpm dev
```

- Web app: http://localhost:3000
- Worker (Socket.IO): http://localhost:3001

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | — | PostgreSQL connection string |
| `REDIS_URL` | — | Redis connection string |
| `ANTHROPIC_API_KEY` | — | Required for AI battle adjudication |
| `MODEL_ADJUDICATOR` | `claude-opus-4-5` | Claude model used for battles |
| `DEFAULT_TURN_DURATION_SECONDS` | `90` | Planning phase timer length |
| `NEXT_PUBLIC_WS_URL` | `http://localhost:3001` | Socket.IO URL (browser-visible) |
| `CORS_ORIGIN` | `http://localhost:3000` | Worker CORS origin |
| `PORT` | `3001` | Worker HTTP/WS port |
| `ADMIN_PASSWORD` | `admin` | Password for admin panel |
| `SCENARIOS_DIR` | `<repo>/scenarios` | Override scenario file location |

## Project structure

```
ai-wargames/
├── apps/
│   ├── web/          # Next.js frontend + API routes
│   └── worker/       # Socket.IO server + BullMQ turn worker
├── packages/
│   ├── shared/       # TypeScript types + Zod schemas
│   ├── engine/       # Pure deterministic game logic
│   ├── db/           # Drizzle ORM schema + client
│   └── server/       # Turn resolution + AI adjudicator
└── scenarios/        # JSON scenario data (map, units, wiki lore)
```

## Game rules

**Victory:** Annihilate all enemy units (reduce their strength to zero).

**Turn phases:**
1. **Planning** — both players issue orders for each unit within the turn timer (default 90s). Orders auto-save as you build them.
2. **Resolving** — once both submit (or timer expires), the engine processes: disengage → movement → intercept fire → reinforcement → dig in → retreats → contested battles → morale/rout → victory check.
3. **Debrief** — after each turn, a breakdown of what happened is shown before the next planning phase begins. Previous turns can be reviewed.

**Commands:**
- **Move** — march to an adjacent territory at slow/normal/forced speed with a stance (aggressive/defensive/balanced) and intention (assault/attack/reinforce/balanced)
- **Attack** — fight enemies on your current node; choose stance, intention (assault/attack/defend/breakthrough)
- **Dig in** — fortify your position; intention is hold (improve defense) or deny (block enemy movement into this node)
- **Cover** — shield an ally unit during combat
- **Retreat** — withdraw along your entry route
- **Disengage** — vote to break contact (requires both factions to agree)

**Contested battles:** When both factions occupy the same node after movement, Claude receives full unit stats (strength, morale, fatigue, dug-in level, terrain, intentions) plus a lookup tool for scenario wiki lore, and adjudicates per-unit outcomes with a narrative description.

## Scenarios

Two scenarios are included in `scenarios/`:

- **`battle-of-fords`** — The First Battle of the Fords of Isen (used by default for new rooms)
- **`rohan-vs-isengard`** — Broader Rohan vs. Isengard campaign map

Each scenario folder contains:
- `scenario.json` — units, factions, capital nodes, combat config
- `map.json` — territory nodes and edges with layout coordinates
- `wiki.json` — lore context fed to the AI adjudicator

## Deployment

The project deploys to [Railway](https://railway.app) as two services:

- **web** — Next.js app (`apps/web`)
- **worker** — Socket.IO + BullMQ worker (`apps/worker`)

Set all environment variables in Railway. The `railway.toml` at the repo root configures both services.

## Admin panel

Visit the home page and expand the Admin section. Enter the `ADMIN_PASSWORD` to:

- List and delete active rooms
- Create a solo dual-faction game (one player controls both sides, no turn timer)
