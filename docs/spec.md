# Project specification — structure and architecture

This repository is the **B2B SaaS Kit** (package `@fogbender/b2bsaaskit`): an open-source starter for team-oriented SaaS products. The reference application is **Prompts with Friends** — collaborative GPT prompts with orgs, sharing, and optional billing.

## Tech stack (at a glance)

| Layer | Choice |
|--------|--------|
| Framework | [Astro](https://astro.build) 5 (`output` aligned with static + SSR islands via `prerender` and API routes) |
| UI (interactive) | React 18 |
| Styling | Tailwind CSS 3 |
| API | [tRPC](https://trpc.io) v10 + TanStack Query v4 |
| Database | PostgreSQL via [Drizzle ORM](https://orm.drizzle.team) + `postgres` driver |
| Auth (B2B) | [PropelAuth](https://propelauth.com) |
| Hosting adapter | `@astrojs/vercel` |
| Env validation | `@t3-oss/env-core` + Zod (`src/t3-env.ts`) |

Optional integrations (feature-flagged by env): Stripe, PostHog, Fogbender support widget, OpenAI.

## Repository layout

```
/workspace
├── astro.config.mjs          # Astro + React, Vercel adapter, Vite checker, SITE_URL
├── drizzle.config.ts         # Drizzle Kit → schema path, migrations under src/db
├── eslint.config.js / .prettierrc
├── package.json              # Yarn scripts: dev, build, ci:check, migrate, lint, fmt
├── tailwind.config.cjs / postcss.config.cjs
├── docs/                     # Project documentation (this file)
├── .github/
│   ├── workflows/            # lint, prettier, typescript on PR/push
│   └── actions/prepare/      # Node + yarn install for CI
└── src/
    ├── config.ts             # Client env bridge (import.meta.env as ClientEnv)
    ├── t3-env.ts             # Zod-validated server + PUBLIC_* client env
    ├── constants.ts          # Cookie names, shared constants
    ├── types/types.ts
    ├── env.d.ts              # Astro / Vite typings
    ├── styles/tailwind.css
    ├── assets/               # SVGs for marketing
    ├── layouts/Layout.astro  # Default page shell
    ├── content/              # Astro Content Collections
    │   ├── config.ts         # `setup` + `eject` collection schemas
    │   ├── setup/*.md        # Onboarding steps (rendered at /setup)
    │   └── eject/*.md        # “Eject” guides per dependency
    ├── db/
    │   ├── schema.ts         # Drizzle tables: prompts, likes, gpt_keys, surveys, etc.
    │   ├── db.ts             # Drizzle client (postgres.js)
    │   ├── scripts/migrate.ts
    │   ├── *.sql / meta/     # Generated migrations + Drizzle meta
    ├── lib/
    │   ├── trpc/
    │   │   ├── trpc.ts       # initTRPC, superjson, api/auth/org procedures
    │   │   ├── root.ts       # appRouter composition + createHelpers(Astro)
    │   │   └── routers/      # auth, hello, prompts, settings, surveys
    │   ├── stripe.ts, posthog.ts, propelauth.ts
    │   └── router.tsx        # react-router static handler + createRouterContext(Astro)
    ├── pages/                # Astro file-based routes
    │   ├── index.astro, faq.astro, login*.astro, signup.astro
    │   ├── setup/, eject/
    │   ├── prompts/          # Public prompt pages
    │   ├── survey/
    │   ├── og/               # Open Graph image generation (Satori + Resvg)
    │   ├── robots.txt.ts
    │   ├── demo/             # HTMX + tRPC + React demos
    │   ├── api/
    │   │   ├── trpc/[trpc].ts    # fetchRequestHandler for all tRPC
    │   │   ├── create-checkout-session.ts, fogbender.ts, orgs/[orgId].ts
    │   └── app/**            # Authenticated shell → React Root
    └── components/
        ├── app/              # SPA: App, routes, Nav, prompts CRUD, Settings, store (Jotai)
        ├── landing/          # Marketing sections
        ├── head/             # SEO, PostHog, checker overlay
        ├── survey/, setup/, fogbender/, utils/
        ├── trpc.tsx          # TRPCProvider + React Query client
        ├── propelauth.tsx, Login*.tsx, Signup.tsx, AuthSync.tsx, client.tsx
        └── jwt.ts
```

## Request and rendering model

1. **Marketing and docs** — Mostly `.astro` pages with optional `client:*` React islands.
2. **Authenticated app (`/app/*`)** — An Astro page loads `Root` (React) with `createRouterContext` from `src/lib/router.tsx`, which uses **React Router**’s static handler and passes **tRPC server-side helpers** (from `createHelpers(Astro)`) into route loaders for prefetching.
3. **tRPC** — Single catch-all route `src/pages/api/trpc/[trpc].ts` builds context from `Request` + response `Headers`; procedures use `apiProcedure` → cookie parsing → PropelAuth token validation; `authProcedure` / `orgProcedure` enforce user and org scope.
4. **Database** — Server code uses `serverEnv.DATABASE_URL` via Drizzle. Migrations live under `src/db/`; README documents Supabase RLS policies to append to generated SQL.

## Configuration and secrets

- **Doppler** is the documented way to inject env in dev/CI/deploy; `src/t3-env.ts` validates required variables and can skip validation with `SKIP_ENV_VALIDATION`.
- **Client-safe** variables use the `PUBLIC_` prefix and are exposed through `src/config.ts` for bundles that must not import full server env.

## Scripts (from `package.json`)

- `yarn dev` / `yarn build` — Astro.
- `yarn ci:check` — `astro check` + `tsc --noEmit`.
- `yarn migrate` — `tsx src/db/scripts/migrate` (run with Doppler per docs).
- `yarn full:check` — fix + CI check + production-config build.

This document reflects the tree and data flow as of the current branch; for product behavior and third-party setup, the canonical narrative remains `README.md` and the `/setup` content collection.
