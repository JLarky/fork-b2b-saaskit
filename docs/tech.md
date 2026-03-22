# Technical Notes

## Validation Baseline

```bash
# First-time setup
corepack enable
corepack prepare yarn@1.22.19 --activate
yarn

# Astro type generation/sync
yarn astro sync

# Lint + format
yarn lint
yarn fmt:check

# Auto-fix lint + formatting issues
yarn fix

# Tests
yarn test

# Type checks
yarn ci:check

# Production build
yarn build

# All-in check path used by this repo
yarn full:check
```

Notes:

- This repo uses Yarn Classic (`yarn.lock`), not pnpm or npm.
- CI runs on Node 20 via `.github/actions/prepare/action.yml`, while `package.json` allows Node `^18.17.1 || ^20.3.0 || >=22.0.0`.
- `yarn ci:check` runs `astro check && tsc --noEmit`.
- CI splits checks into separate workflows for lint, formatting, tests, and TypeScript; keep local validation aligned with `.github/workflows/`.

## Repository Shape

- App framework: Astro 5 app with React islands and Vercel adapter.
- Astro routes/pages: `src/pages/`
- App shell for logged-in experience: `src/components/app/`
- Shared layouts: `src/layouts/`, `src/components/app/AppLayout.astro`
- tRPC server: `src/lib/trpc/`
- tRPC HTTP entrypoint: `src/pages/api/trpc/[trpc].ts`
- Other API routes: `src/pages/api/`
- React Query + tRPC client provider: `src/components/trpc.tsx`
- React Router SSR/static handler glue for `/app`: `src/lib/router.tsx`
- Database schema/migrations/scripts: `src/db/`
- Environment validation: `src/t3-env.ts`
- Client-safe env access: `src/config.ts`
- Content/setup docs rendered by the app: `src/content/setup/`, `src/content/eject/`
- Shared styles: `src/styles/tailwind.css`
- Public assets: `public/`, `src/assets/`
- Vitest tests: `src/**/*.test.ts`
- Effect service definitions: `src/services/`
- Effect handlers (extracted business logic): `src/handlers/`
- Typed error classes: `src/errors.ts`

## Effect Services (`src/services/`)

Effect is being introduced incrementally (see `docs/specs/effect-migration.md`).
Service definitions live in `src/services/` alongside the existing module-level
singletons (`src/db/db.ts`, `src/lib/propelauth.ts`, etc.) which remain the
runtime path for tRPC procedures until a later migration phase wires Effect
layers in.

| Service     | Tag           | Shape                               | Lifetime              |
| ----------- | ------------- | ----------------------------------- | --------------------- |
| Database    | `Database`    | `PostgresJsDatabase`                | Singleton per isolate |
| Auth        | `Auth`        | `AuthClient` (subset of PropelAuth) | Singleton per isolate |
| Payments    | `Payments`    | `PaymentsClient \| null`            | Singleton per isolate |
| Analytics   | `Analytics`   | `AnalyticsClient`                   | Singleton per isolate |
| HttpRequest | `HttpRequest` | `RequestContext`                    | Per request           |

Each service file exports a `Context.Tag` and an interface. All services except
`HttpRequest` also export a `*Live` layer — `HttpRequest` has no live layer
because it is provided per-request by the route handler.

Test layers use `Layer.succeed` with mocks — see `src/services/services.test.ts`
for patterns.

## Current Stack And Guardrails

- Package manager and runtime:
  - Use Yarn commands by default.
  - Astro dev server is configured for port `3000` in `astro.config.mjs`.

- Frontend:
  - Astro handles routing and page composition.
  - React 18 powers interactive components and the `/app` experience.
  - Tailwind CSS is configured through `tailwind.config.cjs`.

- API layer:
  - tRPC is the primary typed server/client API layer.
  - Main router is `appRouter` in `src/lib/trpc/root.ts`.
  - Server context and auth/org middleware live in `src/lib/trpc/trpc.ts`.

- Auth:
  - PropelAuth is the authentication provider.
  - Server-side auth wiring lives in `src/lib/propelauth.ts`.
  - Auth-dependent tRPC procedures rely on cookies parsed in `src/lib/trpc/trpc.ts`.

- Database:
  - Drizzle ORM + `postgres` client are used against Postgres/Supabase-style infrastructure.
  - Schema source of truth is `src/db/schema.ts`.
  - Existing SQL migrations live in `src/db/*.sql`.
  - Migration apply script is `yarn migrate`.
  - Migration generation is done with `doppler run npx drizzle-kit generate`.
  - If you add a new table, manually add Row Level Security SQL to the generated migration; `src/db/schema.ts` documents the expected pattern.

- Environment/secrets:
  - Environment variables are validated in `src/t3-env.ts` with `@t3-oss/env-core` + Zod.
  - Normal local/dev workflows expect `doppler run ...`, not plain `yarn dev`.
  - `SKIP_ENV_VALIDATION=true` exists as an escape hatch for partial setup, but should not be the default assumption.

- Deployment:
  - Astro uses the Vercel adapter in `astro.config.mjs`.
  - `site` is driven by `process.env.SITE_URL`.

- Testing:
  - Vitest is configured with `environment: 'node'`.
  - Only files matching `src/**/*.test.ts` are included by default.
  - Tests that import service modules (which transitively import `t3-env.ts`) require `SKIP_ENV_VALIDATION=true` when running without full env setup. This is already the case for `yarn test` in CI-like environments without Doppler.

## Documentation Reliability

- `README.md`, the code under `src/`, and setup content in `src/content/setup/` are the current source of truth.
- Several files under `.docs/specs/` appear to be legacy notes from a different codebase. Do not treat them as authoritative for this Astro app unless they are explicitly refreshed.
- When updating docs, prefer matching concrete file paths, scripts, and workflow names from the repo instead of carrying forward older assumptions.
