# B2B SaaS Kit — Project Specification

## Overview

The B2B SaaS Kit is an open-source starter toolkit for building team-based (business-to-business) SaaS products. The reference application is **"Prompts with Friends"**, a collaborative GPT prompt editor where teams can create, share, like, and run AI prompts together.

The kit is designed around two goals:

1. Start with a fully-functional, non-trivial application and modify it into your own product.
2. Build an MVP for the cost of a domain name — every third-party service used offers a meaningful free tier.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Astro | 5.1.8 |
| UI Library | React | ^18.3.1 |
| Styling | Tailwind CSS | ^3.3.3 |
| API | tRPC | ^10.34.0 |
| Data Fetching | TanStack React Query | ^4.29.5 |
| Database | PostgreSQL via Supabase | — |
| ORM | Drizzle ORM | ^0.33.0 |
| Auth | PropelAuth | ^2.1.0 (node), 2.1.0-beta.4 (react) |
| Payments | Stripe | ^12.12.0 |
| Analytics | PostHog | ^1.69.0 |
| Customer Support | Fogbender | ^0.2.11 |
| Secrets Management | Doppler | — |
| State Management | Jotai | ^2.2.2 |
| Client Routing | React Router DOM | ^6.26.0 |
| Deployment | Vercel | @astrojs/vercel 8.0.3 |
| Env Validation | @t3-oss/env-core | ^0.6.0 |
| OG Images | Satori + @resvg/resvg-js | ^0.10.1 / ^2.4.1 |
| HTTP Client | wretch | ^2.5.2 |
| Language | TypeScript | ^5.5.4 |

---

## Directory Structure

```
/
├── .env                              # Doppler placeholder (no real secrets)
├── .github/
│   ├── actions/prepare/action.yml    # CI setup action (Node 18, yarn install)
│   └── workflows/
│       ├── lint.yml                  # ESLint CI check
│       ├── prettier.yml             # Prettier CI check
│       └── typescript.yml           # astro check + tsc --noEmit
├── .vscode/
│   ├── extensions.json              # Recommended Astro extension
│   └── launch.json                  # Doppler-wrapped dev launch config
├── astro.config.mjs                 # Astro config (React, Vercel adapter, Vite plugins)
├── drizzle.config.ts                # Drizzle ORM migration config
├── eslint.config.js                 # ESLint flat config
├── package.json                     # Dependencies, scripts, engine constraints
├── postcss.config.cjs               # PostCSS config for Tailwind
├── tailwind.config.cjs              # Tailwind CSS config
├── tsconfig.json                    # TypeScript strict config extending Astro
├── public/
│   └── readme-images/               # Static images for README
└── src/
    ├── assets/                       # SVG illustrations
    ├── components/                   # UI components (React + Astro)
    │   ├── app/                      # App shell and main feature components
    │   ├── fogbender/                # Fogbender support widget
    │   ├── head/                     # SEO, PostHog, overlay components
    │   ├── landing/                  # Landing page variants (dev/prod)
    │   ├── setup/                    # Setup wizard step component
    │   ├── survey/                   # Feedback survey component
    │   └── utils/                    # Utility components (clipboard copy)
    ├── config.ts                     # Client-safe env re-export
    ├── constants.ts                  # App-wide constants (cookie names, titles)
    ├── content/                      # Astro content collections
    │   ├── config.ts                 # Collection definitions
    │   ├── eject/                    # "Eject" guides for each service
    │   └── setup/                    # Step-by-step setup guides
    ├── db/
    │   ├── db.ts                     # Drizzle client initialization
    │   ├── schema.ts                 # Database schema (Drizzle pgTable definitions)
    │   ├── scripts/migrate.ts        # Migration runner script
    │   ├── meta/                     # Drizzle migration metadata
    │   └── 0000_yummy_ben_parker.sql # Initial migration SQL
    ├── env.d.ts                      # Astro env type declarations
    ├── layouts/Layout.astro          # Root Astro layout (SEO, PostHog, global styles)
    ├── lib/
    │   ├── posthog.ts                # PostHog server-side event tracking
    │   ├── propelauth.ts             # PropelAuth server-side initialization
    │   ├── router.tsx                # SSR router context (createStaticHandler)
    │   ├── stripe.ts                 # Stripe helpers (checkout, subscriptions)
    │   └── trpc/
    │       ├── root.ts               # appRouter definition, SSR helpers
    │       ├── trpc.ts               # tRPC init, context, middleware, procedures
    │       └── routers/
    │           ├── auth.ts           # Auth cookie sync mutation
    │           ├── hello.ts          # Demo hello endpoint
    │           ├── prompts.ts        # CRUD for prompts, likes, OpenAI integration
    │           ├── settings.ts       # OpenAI key management, Stripe subscriptions
    │           └── surveys.ts        # Feedback survey submission
    ├── pages/
    │   ├── api/
    │   │   ├── create-checkout-session.ts   # Stripe checkout API route
    │   │   ├── fogbender.ts                 # Fogbender JWT API route
    │   │   ├── orgs/[orgId].ts              # Org member listing API route
    │   │   └── trpc/[trpc].ts               # tRPC fetch adapter API route
    │   ├── app/                      # Authenticated app pages (SSR)
    │   │   ├── index.astro           # App home
    │   │   ├── prompts.astro         # Prompts list
    │   │   ├── prompts/[id].astro    # Single prompt view
    │   │   ├── prompts/[id]/edit.astro # Prompt editor
    │   │   ├── prompts/create.astro  # New prompt
    │   │   ├── settings.astro        # Org settings (keys, subscriptions)
    │   │   └── support.astro         # Fogbender support
    │   ├── demo/                     # Demo/example pages (tRPC, React, htmx)
    │   ├── eject/index.astro         # Eject guide index
    │   ├── index.astro               # Landing page
    │   ├── login.astro               # Login page
    │   ├── login-passwordless.astro  # Passwordless login page
    │   ├── og/index.ts               # Dynamic OG image generation
    │   ├── prompts/                  # Public prompt pages
    │   ├── robots.txt.ts             # Dynamic robots.txt
    │   ├── setup/index.astro         # Setup wizard
    │   ├── signup.astro              # Signup page
    │   └── survey/[...path].astro    # Survey pages
    ├── styles/tailwind.css           # Tailwind base import
    ├── t3-env.ts                     # Env variable validation (Zod schemas)
    └── types/types.ts                # Shared type definitions
```

---

## Architecture

### Rendering Model

The app uses **Astro's hybrid rendering**:

- **Static (SSG)** by default (`output: 'static'` in `astro.config.mjs`).
- **SSR** opted in per-route with `export const prerender = false` (used for API routes, app pages, and dynamic content).
- **React islands** (`client:load` / `client:only="react"`) for interactive components within Astro pages.

### Request Flow

```
Browser Request
    │
    ▼
Astro Page (.astro)
    │
    ├── Static pages → served from CDN
    │
    └── SSR pages (prerender = false)
        │
        ├── Frontmatter runs server-side
        │   ├── createHelpers(Astro) → tRPC SSR prefetch
        │   └── Data passed as props to React islands
        │
        └── React Island hydrates in browser
            ├── TRPCProvider (React Query + superjson)
            ├── React Router (client-side routing within /app)
            └── tRPC hooks (useQuery/useMutation) → /api/trpc/*
```

### App Shell Pattern

The `/app/*` routes use a hybrid SSR + SPA pattern:

1. Astro page renders `<AppLayout>` with `<Root>` React component.
2. `Root.tsx` wraps the app in `TRPCProvider` + `QueryClientProvider`.
3. On the server: `ServerRouter` uses `createStaticRouter` from React Router to render with prefetched data.
4. On the client: `BrowserRouter` takes over for SPA navigation.
5. `routes.tsx` defines all app routes with loaders that prefetch tRPC data.

### Authentication Flow

1. PropelAuth handles user signup/login via hosted UI.
2. `AuthSync.tsx` component bridges PropelAuth tokens to server cookies:
   - Watches PropelAuth auth state on the client.
   - Calls `auth.authSync` tRPC mutation to set HTTP-only cookies.
3. Server-side, tRPC middleware reads cookies:
   - `apiProcedure` → parses cookies, extracts access token.
   - `authProcedure` → validates token with PropelAuth, gets user.
   - `orgProcedure` → verifies user belongs to the required org.

### tRPC Layer

All API calls go through a single endpoint at `/api/trpc/[trpc].ts` which uses the fetch adapter.

**Router hierarchy:**

```
appRouter
├── hello      — demo endpoint
├── auth       — cookie sync (authSync mutation)
├── prompts    — CRUD, likes, run prompt (OpenAI), public listing
├── settings   — OpenAI key management, Stripe subscription queries
└── surveys    — feedback survey submission
```

**Procedure types (progressive auth):**

| Procedure | Auth Level | Purpose |
|---|---|---|
| `publicProcedure` | None | Unauthenticated access |
| `apiProcedure` | Requires `req`/`resHeaders` | Cookie parsing, optional auth |
| `authProcedure` | Requires valid user | Authenticated operations |
| `orgProcedure` | Requires user + org membership | Organization-scoped operations |

### Database Schema

PostgreSQL via Supabase, managed with Drizzle ORM:

| Table | Purpose | Key Fields |
|---|---|---|
| `prompts` | GPT prompt storage | id, user_id, org_id, template (JSON), title, description, tags (JSON), privacy_level |
| `prompt_likes` | Per-user prompt likes | prompt_id + user_id (composite PK) |
| `gpt_keys` | Org OpenAI API keys | id, key_public, key_secret, key_type (gpt-3/gpt-4), org_id |
| `shared_key_ratelimit` | Rate limiting for shared key | id (user+period hash), value (counter) |
| `surveys` | User feedback | id, rating, is_public, comments |

All tables have Row Level Security (RLS) enabled with a `service_role` policy.

### Environment Configuration

Environment variables are validated at startup using `@t3-oss/env-core` with Zod schemas (`src/t3-env.ts`):

**Required server-side:**
- `DATABASE_URL` — PostgreSQL connection string
- `PROPELAUTH_API_KEY`, `PROPELAUTH_VERIFIER_KEY` — Auth backend keys

**Required client-side:**
- `PUBLIC_AUTH_URL` — PropelAuth hosted auth URL

**Optional:**
- `FOGBENDER_SECRET`, `PUBLIC_FOGBENDER_WIDGET_ID` — Customer support
- `OPENAI_API_KEY` — Shared/default OpenAI key
- `STRIPE_SECRET_KEY`, `STRIPE_PRICE_ID` — Payments
- `PUBLIC_POSTHOG_KEY` — Analytics

Validation can be skipped with `SKIP_ENV_VALIDATION=true`.

### Payments (Stripe)

- Checkout sessions are created via `/api/create-checkout-session` REST endpoint.
- Subscriptions are searched by `orgId` metadata via `stripe.subscriptions.search`.
- Subscription status gates access to the shared OpenAI key (bypasses rate limit).

### Rate Limiting

The shared OpenAI key is rate-limited per user: 3 requests per 24-hour rolling window. Implemented via upsert to `shared_key_ratelimit` table with a time-bucketed key.

---

## CI/CD

### GitHub Actions Workflows

| Workflow | Trigger | Action |
|---|---|---|
| `lint.yml` | PR, merge group, push to main | `yarn astro sync` → `yarn lint` (ESLint) |
| `prettier.yml` | PR, merge group, push to main | `yarn fmt --check --write=false` |
| `typescript.yml` | PR, merge group, push to main | `yarn astro sync` → `yarn ci:check` |

All workflows use a shared `prepare` action: Node 18, `yarn install --frozen-lockfile`.

### Build & Deployment

- **Build:** `yarn build` → `astro build` (output: Vercel serverless functions + static assets).
- **Deploy:** Vercel adapter (`@astrojs/vercel`) with Doppler integration for secrets.
- **Migrations:** `doppler run yarn migrate` (dev) / `doppler run --config prd yarn migrate` (prod).

---

## Content System

Astro Content Collections power the setup and eject documentation:

- `src/content/setup/*.md` — Step-by-step setup guides for each service (Doppler, Supabase, PropelAuth, Stripe, etc.)
- `src/content/eject/*.md` — Guides for removing/replacing each integrated service.

These are rendered on `/setup` and `/eject` pages respectively, providing an interactive onboarding and customization experience.

---

## Key Design Decisions

1. **Astro + React hybrid** — Astro for routing, layouts, and static content; React for interactive app shell.
2. **tRPC for API** — End-to-end type safety, no manual API contracts, integrated with React Query for caching.
3. **Progressive auth middleware** — Procedure chain (`public` → `api` → `auth` → `org`) allows fine-grained access control.
4. **Doppler for secrets** — Avoids committing `.env` files; Doppler injects vars at runtime.
5. **SSR + SPA hybrid** — Server-side prefetch via tRPC helpers → dehydrated state → client hydration with React Router.
6. **Content collections for docs** — Setup and eject guides are Markdown files managed by Astro's content system.
