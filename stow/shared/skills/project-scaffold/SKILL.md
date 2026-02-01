---
name: project-scaffold
description: "Project structure and database selection. Trigger: new project, project setup, scaffold, monorepo, turborepo, database selection, sqlite vs postgres, convex. Use when user describes building something new."
---

# Project Scaffolding

## When to Use

- User says "build me X", "create a new project", "start a project"
- Questions about monorepo vs single package
- Database selection discussions
- Project structure decisions

## Database Selection

```
Is this TypeScript-only?
├─ Yes: Do you need realtime/reactivity?
│  ├─ Yes: Is DX priority over control?
│  │  ├─ Yes → Convex (managed, realtime, auth, file storage built-in)
│  │  └─ No → Postgres + Drizzle + websockets/SSE
│  └─ No: Is data local-first or single-user?
│     ├─ Yes → SQLite + Drizzle (or libsql for sync)
│     └─ No: Serverless/edge deployment?
│        ├─ Yes → Turso (libsql) + Drizzle
│        └─ No → Postgres + Drizzle
└─ No (Python involved):
   → Convex excluded (no Python SDK)
   → Is data local-first or single-user?
      ├─ Yes → SQLite
      └─ No → Postgres
```

### Database Quick Reference

| Database | Best For | Avoid When |
|----------|----------|------------|
| Convex | TS-only, realtime, rapid prototyping, LLM apps | Python needed, want SQL control, cost-sensitive at scale |
| SQLite | Local-first, CLI tools, single-user, embedded | Multi-writer, high concurrency, need sync |
| Turso (libsql) | Edge/serverless, SQLite with sync, preview envs | Need raw Postgres features, complex transactions |
| Postgres | Multi-service, complex queries, proven reliability | Simple local apps, edge without pooling |

### ORM Choice

**TypeScript:** Drizzle (not Prisma)
**Python:** SQLAlchemy 2.0 or raw SQL with asyncpg

## Project Shapes

### 1. CLI Only

Single package, no monorepo overhead.

**TypeScript:**
```
my-cli/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts        # Commander.js entry
│   ├── commands/       # Command implementations
│   └── lib/            # Shared utilities
└── dist/
```

**Python:**
```
my-cli/
├── pyproject.toml
├── src/
│   └── my_cli/
│       ├── __init__.py
│       ├── main.py     # Typer entry
│       ├── commands/   # Command implementations
│       └── lib/        # Shared utilities
└── tests/
```

### 2. CLI + Database

Still single package. Add Drizzle/SQLAlchemy.

**TypeScript:**
```
my-cli/
├── package.json
├── tsconfig.json
├── drizzle.config.ts
├── src/
│   ├── index.ts
│   ├── commands/
│   ├── db/
│   │   ├── index.ts    # Connection
│   │   ├── schema.ts   # Drizzle schema
│   │   └── migrations/
│   └── lib/
└── dist/
```

**Python:**
```
my-cli/
├── pyproject.toml
├── alembic.ini
├── src/
│   └── my_cli/
│       ├── __init__.py
│       ├── main.py
│       ├── commands/
│       ├── db/
│       │   ├── __init__.py
│       │   ├── models.py
│       │   └── migrations/
│       └── lib/
└── tests/
```

### 3. Web App + Database (Single Package)

No monorepo for simple full-stack apps.

**TypeScript (Next.js + Drizzle):**
```
my-app/
├── package.json
├── next.config.js
├── drizzle.config.ts
├── src/
│   ├── app/            # Next.js app router
│   ├── components/
│   ├── db/
│   │   ├── index.ts
│   │   ├── schema.ts
│   │   └── migrations/
│   └── lib/
└── public/
```

**TypeScript (Convex):**
```
my-app/
├── package.json
├── convex/
│   ├── schema.ts       # Convex schema
│   ├── functions/      # Backend functions
│   └── _generated/
├── src/
│   ├── app/
│   └── components/
└── public/
```

### 4. CLI + Web App + Database

Now you need separation. Monorepo time.

**TypeScript (Turborepo):**
```
my-project/
├── package.json
├── turbo.json
├── packages/
│   ├── db/             # Shared Drizzle schema + client
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── schema.ts
│   │   │   └── client.ts
│   │   └── drizzle.config.ts
│   └── shared/         # Shared types, utils
│       ├── package.json
│       └── src/
├── apps/
│   ├── web/            # Next.js app
│   │   ├── package.json
│   │   └── src/
│   └── cli/            # Commander.js CLI
│       ├── package.json
│       └── src/
└── tooling/            # Shared configs
    ├── eslint/
    └── typescript/
```

**Python:**
```
my-project/
├── pyproject.toml      # Workspace root
├── packages/
│   ├── core/           # Shared business logic + DB
│   │   ├── pyproject.toml
│   │   └── src/core/
│   │       ├── db/
│   │       ├── models/
│   │       └── services/
│   └── shared/         # Shared types, utils
├── apps/
│   ├── api/            # FastAPI
│   │   ├── pyproject.toml
│   │   └── src/api/
│   └── cli/            # Typer
│       ├── pyproject.toml
│       └── src/cli/
└── tests/
```

**Mixed Python + TypeScript:**
```
my-project/
├── package.json        # Root for TS tooling
├── turbo.json
├── pyproject.toml      # Root for Python workspace
├── packages/
│   └── shared-types/   # Generated types (TypeScript)
├── apps/
│   ├── web/            # Next.js (TypeScript)
│   ├── api/            # FastAPI (Python)
│   └── cli/            # Typer (Python)
└── tooling/
```

### 5. Multiple Web Apps

Turborepo with shared packages.

```
my-project/
├── package.json
├── turbo.json
├── packages/
│   ├── ui/             # Shared component library
│   ├── db/             # Shared database
│   └── shared/         # Shared utils, types
├── apps/
│   ├── web/            # Main app
│   ├── admin/          # Admin dashboard
│   └── docs/           # Documentation site
└── tooling/
```

## Backend Framework Selection

```
TypeScript API:
├─ Simple REST, few endpoints → Hono (lightweight, edge-compatible)
├─ Standard API, moderate complexity → Express + tRPC
└─ Complex, needs DI/modules/guards → NestJS

Python API:
└─ Always FastAPI (async, typed, fast, good DX)
```

## When NOT to Use Monorepo

- Single CLI tool
- Single web app (even with DB)
- Prototype/MVP
- Solo project that won't grow

Monorepo overhead isn't free. Don't add it speculatively.

## Turborepo Setup Notes

```bash
# Create new turborepo
npx create-turbo@latest

# Or add to existing
npm install turbo --save-dev
```

Key `turbo.json` tasks:
```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "typecheck": {}
  }
}
```

## Python Monorepo with uv

```toml
# Root pyproject.toml
[tool.uv.workspace]
members = ["apps/*", "packages/*"]
```

```bash
# Run command in specific package
uv run --package api uvicorn api.main:app

# Add dependency to specific package
uv add --package cli typer
```
