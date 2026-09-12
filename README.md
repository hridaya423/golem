# GOLEM

Give it an image. Get a world with rules.

## Prerequisites

- Node 26.7.0
- pnpm 10.33.0

## Setup

```bash
pnpm install
pnpm exec playwright install chromium
test -e .env.local || cp .env.example .env.local
```

Fill in the variable names in `.env.local` (`REACTOR_API_KEY`, `RUNWARE_API_KEY`, `GAME_COMPILER_*`). That file is gitignored and stays local/server-only.

## Run

```bash
pnpm dev
```

## Status

Gate 0 (app shell, docs, test lab) complete. A live generated world is not yet proven — no paid or model-backed path is wired up.
