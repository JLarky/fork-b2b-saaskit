# Investigation: Switching from Supabase to Convex

## Executive Summary

**Recommendation: Not recommended at this time.** The migration would introduce significant architectural disruption for marginal benefit given the project's current usage of Supabase. Below is the detailed analysis.

---

## 1. Current Supabase Usage Audit

### What Supabase actually provides in this project

Supabase is used **exclusively as a managed PostgreSQL host**. The project does not use any of Supabase's higher-level services:

| Supabase Feature | Used? | Details |
|------------------|-------|---------|
| Managed Postgres | **Yes** | Only feature used — via `DATABASE_URL` connection string |
| Supabase JS Client | No | Not installed, not imported |
| Supabase Auth | No | Auth is handled by PropelAuth |
| Supabase Storage | No | No file storage usage |
| Supabase Realtime | No | No realtime subscriptions |
| Supabase Edge Functions | No | No edge functions |
| Row Level Security | Partially | RLS policies exist but are permissive pass-through for `service_role` |

### How the database is accessed

- **ORM**: Drizzle ORM (`drizzle-orm` + `drizzle-kit`)
- **Driver**: `postgres` npm package (direct Postgres wire protocol)
- **Connection**: Standard `DATABASE_URL` connection string
- **API layer**: tRPC with TanStack React Query

### Database schema (5 tables)

| Table | Purpose | Complexity |
|-------|---------|------------|
| `prompts` | Core entity — GPT prompt templates | Standard CRUD + JSON columns |
| `prompt_likes` | Many-to-many likes (composite PK) | Simple join table |
| `gpt_keys` | OpenAI API keys per org | Standard CRUD + enum type |
| `shared_key_ratelimit` | Rate limiting via upsert | Upsert pattern with `onConflictDoUpdate` |
| `surveys` | User feedback | Simple insert/select |

### Query patterns used

- Standard selects with `WHERE`, `ORDER BY`, `LIMIT`
- `LEFT JOIN` with `GROUP BY` and aggregate (`COUNT`) for like counts
- Raw SQL expressions: `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` for per-user like detection
- `onConflictDoUpdate` (upsert) for rate limiting
- Transactions (in key management)
- Composite primary keys

---

## 2. What Convex Would Replace

Since Supabase is only providing managed Postgres, a migration to Convex would replace:

1. **The database engine** — from PostgreSQL (relational) to Convex (reactive document store)
2. **The ORM** — from Drizzle ORM to Convex's TypeScript function API
3. **The API layer** — Convex's model encourages replacing tRPC with Convex queries/mutations
4. **The data fetching layer** — Convex has its own reactive hooks, partially overlapping with TanStack React Query

This is not a simple provider swap — it is an architectural overhaul.

---

## 3. Migration Complexity Analysis

### 3.1 Schema Translation

Each table must be converted from a relational schema to Convex's document model:

| Concern | PostgreSQL / Drizzle | Convex | Migration Effort |
|---------|---------------------|--------|-----------------|
| Primary keys | Custom text/serial IDs (`nanoid`, `serial`) | Convex-native `_id` field | **High** — all ID references throughout the codebase must change, or legacy IDs maintained via indexes |
| Composite primary keys | `prompt_likes(prompt_id, user_id)` | Not natively supported — requires unique index workaround | **Medium** |
| Enum types | `pgEnum('gpt_type', ['gpt-3', 'gpt-4'])` | Convex `v.union(v.literal(...))` | **Low** |
| JSON columns | `json('template')`, `json('tags')` | Native document fields | **Low** |
| Timestamps | `timestamp` with `defaultNow()` | `v.number()` storing epoch ms | **Low** — but convention change |
| Auto-increment | `serial` for `gpt_keys.id`, `surveys.id` | Not available — must use Convex `_id` or custom counter | **Medium** |

### 3.2 Query Pattern Translation

| Current Pattern | Convex Equivalent | Difficulty |
|----------------|-------------------|------------|
| `SELECT ... WHERE` | `db.query("table").filter(...)` | Low |
| `LEFT JOIN` + `GROUP BY` + `COUNT` (like counts) | No native joins — requires multiple queries or denormalization via aggregate component | **High** |
| `SUM(CASE WHEN ...)` (per-user like check) | Must be implemented as separate query | **Medium** |
| `onConflictDoUpdate` (upsert) | Must be implemented as read-then-write in a mutation | **Medium** |
| `db.transaction(async (trx) => { ... })` | Convex mutations are inherently transactional | **Low** (actually simpler) |
| `ORDER BY ... DESC` | `.order("desc")` on indexed field | Low |
| Raw SQL (`sql\`...\``) | Not possible — must use Convex query API | **High** for complex expressions |

### 3.3 Architecture Changes Required

#### tRPC replacement
The project has a mature tRPC setup with custom procedure builders (`publicProcedure`, `apiProcedure`, `authProcedure`, `orgProcedure`) that handle auth, org-scoping, and cookie parsing. All of this middleware would need to be rebuilt as Convex function wrappers or a "Better Convex" cRPC setup.

**Files affected**: All routers (`prompts.ts`, `settings.ts`, `surveys.ts`, `auth.ts`, `hello.ts`), `trpc.ts`, `root.ts`, all API routes, all components consuming tRPC hooks.

#### TanStack React Query replacement
The project uses `trpc.useQuery()` and `trpc.useMutation()` throughout React components. Convex has its own `useQuery` and `useMutation` hooks. Every component that queries data would need to be rewritten.

#### SSR/SSG integration
The project has a carefully built SSR integration with tRPC server-side helpers (`createTRPCServerSideHelpers`) for Astro. This enables server-side data fetching and hydration. Convex's Astro integration is immature — there is an official starter template but no dedicated framework documentation, and SSR/SSG prefetch patterns are not well-documented.

#### PropelAuth integration
Auth is handled by PropelAuth, which provides user IDs and org membership info. This would remain unchanged, but the auth middleware that currently lives in tRPC procedures would need to be reimplemented as Convex function guards.

### 3.4 Files That Must Change

| Category | Files | Scope of Changes |
|----------|-------|-----------------|
| Database layer | `src/db/db.ts`, `src/db/schema.ts` | **Full rewrite** → becomes `convex/schema.ts` |
| Migrations | `src/db/0000_yummy_ben_parker.sql`, `drizzle.config.ts` | **Delete** — Convex handles schema internally |
| tRPC routers | `src/lib/trpc/routers/*.ts` (5 files) | **Full rewrite** → becomes Convex functions |
| tRPC infrastructure | `src/lib/trpc/trpc.ts`, `src/lib/trpc/root.ts` | **Full rewrite or delete** |
| API routes | `src/pages/api/trpc/[trpc].ts` | **Rewrite** — different API integration |
| React components | `src/components/app/*.tsx` (all data-fetching components) | **Significant rewrite** of data-fetching hooks |
| Astro pages | `src/pages/app/*.astro`, `src/pages/prompts/*.astro` | **Rewrite** SSR helpers |
| Config | `package.json`, `tsconfig.json`, `astro.config.mjs` | **Update** dependencies and config |
| Demo | `src/pages/demo/htmx/_db.ts` | **Rewrite** |
| Env config | `src/t3-env.ts` | **Remove** `DATABASE_URL`, add Convex env vars |
| Documentation | `README.md`, setup/eject content files (6+ files) | **Rewrite** all Supabase/Drizzle references |

**Estimated scope**: ~25-30 files with substantial changes, including full rewrites of the data layer, API layer, and significant parts of the frontend.

---

## 4. What Convex Would Bring

### Potential Benefits

| Benefit | Relevance to This Project |
|---------|--------------------------|
| **Built-in realtime** — automatic reactive updates when data changes | **Low** — the app doesn't use realtime features today. Prompt CRUD doesn't need live updates. |
| **No ORM / no SQL** — TypeScript functions for everything | **Neutral** — Drizzle already provides excellent TypeScript integration with type safety. |
| **End-to-end type safety** | **Neutral** — already achieved via tRPC + Drizzle + Zod. |
| **Zero cold starts** (V8 isolate architecture) | **Low** — the app is deployed on Vercel with SSR, which has its own cold start characteristics. |
| **Built-in auth** | **Not applicable** — auth is via PropelAuth and would remain so. |
| **Automatic caching** | **Low** — tRPC + TanStack Query already provide client-side caching and deduplication. |
| **Simpler backend model** | **Debatable** — Convex functions are simpler in isolation, but the total migration effort offsets this. |
| **Built-in vector search** | **Low** — not needed by the current app. |

### Potential Drawbacks

| Drawback | Impact |
|----------|--------|
| **Vendor lock-in** | **High** — Convex open-sourced its backend in Feb 2025, but self-hosting is not mature. Supabase/Postgres is fully portable. |
| **No SQL** | **Medium** — the project uses raw SQL for aggregate queries (like counts, conditional sums). These are harder in Convex. |
| **No native joins** | **Medium** — `getPrompt` uses a `LEFT JOIN` with aggregation. Must be denormalized or split into multiple queries. |
| **Immature Astro integration** | **High** — no formal docs, no clear SSR prefetch story. The project's SSR/SSG architecture relies on tRPC helpers that have no Convex equivalent. |
| **tRPC replacement burden** | **High** — the tRPC setup is deeply integrated with custom middleware, auth, and the entire frontend. Replacing it is the single largest cost. |
| **Loss of Drizzle migration tooling** | **Low** — Convex handles schema changes internally, but you lose explicit migration files and rollback control. |
| **Learning curve** | **Medium** — the team must learn Convex's document model, function types (queries vs mutations vs actions), and deployment model. |
| **Pricing model change** | **Low** — both have free tiers. Convex's usage-based pricing vs Supabase's tier-based pricing could go either way. |

---

## 5. Alternative Approaches

If the goal is to move away from Supabase specifically (not Postgres), the project's own [eject guide](src/content/eject/supabase.md) documents the simplest path:

### Option A: Switch Postgres provider (minimal effort)
Change `DATABASE_URL` to point to a different managed Postgres host (Neon, Railway, Render, AWS RDS, etc.) and remove Supabase-specific RLS policies. **~1 hour of work.**

### Option B: Switch to a different Drizzle-supported database (moderate effort)
Drizzle ORM supports MySQL, SQLite, and other databases. Update `schema.ts`, `db.ts`, and `drizzle.config.ts`. **~1-2 days equivalent in scope.**

### Option C: Switch to Convex (high effort)
Full architectural rewrite as described above. **Touches ~25-30 files across data layer, API layer, frontend, and documentation.**

---

## 6. Recommendation

**Do not switch to Convex** unless one of the following is true:

1. **You need built-in realtime** and plan to add collaborative features (e.g., real-time prompt editing, live cursors, presence indicators). In that case, Convex's reactive model would provide genuine value.

2. **You plan to remove tRPC** regardless and want to simplify the backend architecture. Convex would then be a reasonable choice for a greenfield rewrite.

3. **You are starting a new project** inspired by this kit. Convex would be a fine choice for a new B2B app with simpler data patterns.

### Why not switch

- **Supabase is barely used** — it's just a Postgres host. The "Supabase dependency" is really just a connection string.
- **The migration scope is enormous** — it's not replacing one service with another; it's rewriting the data layer, API layer, and parts of the frontend.
- **The current stack works well** — Drizzle + tRPC + TanStack Query already provide type safety, caching, and a good developer experience.
- **Convex's Astro integration is immature** — the project's SSR/SSG patterns have no clear Convex equivalent.
- **The project is designed to be forkable** — PostgreSQL is the most widely understood database. Switching to Convex's document model raises the barrier for contributors.

### If you do want to reduce Supabase coupling

The simplest step is to update the documentation and setup guides to be Postgres-provider-agnostic, since the codebase itself is already provider-agnostic. The only Supabase-specific code is the RLS policies in migration files, which are passthrough rules required by Supabase's default RLS enforcement.
