# Project structure spec

## 1. Purpose

This repository is the `@fogbender/b2bsaaskit` starter kit. It ships a sample B2B SaaS application called "Prompts with Friends" and is meant to be cloned, configured, and then modified into a different product.

The repo combines:

- Astro for page routing and server rendering
- React for interactive UI islands and the authenticated app shell
- tRPC for typed backend procedures
- Drizzle ORM with Postgres for persistence
- PropelAuth for auth and organization membership
- Optional Stripe, PostHog, Fogbender, and OpenAI integrations

## 2. Runtime and build stack

- Package manager: Yarn 1
- Language: TypeScript with Astro strictest base config
- Web framework: Astro 5
- UI: React 18, Tailwind CSS
- Data/API: tRPC + TanStack Query
- Database: Postgres via `postgres` + Drizzle ORM
- Deployment target: Vercel adapter
- Supplemental UI runtime: Solid is used only inside the setup/eject accordion component

Key files:

- `package.json`: scripts, dependencies, runtime engines
- `astro.config.mjs`: Astro + Vercel + Vite checker setup
- `tsconfig.json`: TypeScript mode
- `drizzle.config.ts`: schema and migration output location
- `eslint.config.js`: lint rules and exceptions

## 3. Top-level layout

### Root files

- `README.md`: product and local setup overview
- `package.json`: commands and dependencies
- `astro.config.mjs`: Astro server/build config
- `drizzle.config.ts`: Drizzle configuration
- `eslint.config.js`: lint config
- `tailwind.config.cjs` and `postcss.config.cjs`: styling pipeline
- `.github/workflows/*`: CI checks for lint, formatting, and type checking

### Main directories

- `src/pages`: Astro routes and API endpoints
- `src/components`: React and Astro UI components
- `src/lib`: shared backend/frontend integration code
- `src/db`: schema, migrations, and DB client
- `src/content`: markdown collections for setup and eject guides
- `src/assets`: static assets imported into Astro/React
- `public`: public static files

## 4. Architectural layers

### 4.1 Page layer

Astro file routing lives in `src/pages`.

There are four broad route groups:

1. Marketing/public pages

   - `src/pages/index.astro`
   - `src/pages/faq.astro`
   - `src/pages/prompts/*`
   - `src/pages/survey/[...path].astro`

2. Auth entry pages

   - `src/pages/login.astro`
   - `src/pages/login-passwordless.astro`
   - `src/pages/signup.astro`

3. Authenticated app shells

   - `src/pages/app/index.astro`
   - `src/pages/app/prompts.astro`
   - `src/pages/app/prompts/[id].astro`
   - `src/pages/app/prompts/create.astro`
   - `src/pages/app/prompts/[id]/edit.astro`
   - `src/pages/app/settings.astro`
   - `src/pages/app/support.astro`

4. Backend/API routes
   - `src/pages/api/trpc/[trpc].ts`
   - `src/pages/api/create-checkout-session.ts`
   - `src/pages/api/fogbender.ts`
   - `src/pages/api/orgs/[orgId].ts`

There are also special routes for OG image generation (`src/pages/og/*`) and demos (`src/pages/demo/*`).

### 4.2 Application UI layer

The authenticated product UI is React-based and centered in `src/components/app`.

Important files:

- `Root.tsx`: chooses server vs browser router
- `BrowserRouter.tsx`: client router bootstrap
- `ServerRouter.tsx`: SSR router bootstrap
- `routes.tsx`: route tree, loaders, and prefetching
- `Prompts.tsx`, `Prompt.tsx`, `CreatePrompt.tsx`, `EditPrompt.tsx`, `Settings.tsx`: main feature screens

This means `/app/*` uses Astro as the HTTP/page shell and React Router for in-app navigation.

### 4.3 API layer

The main backend contract is tRPC.

- Entry point: `src/pages/api/trpc/[trpc].ts`
- Root router: `src/lib/trpc/root.ts`
- Context and procedures: `src/lib/trpc/trpc.ts`
- Feature routers:
  - `src/lib/trpc/routers/auth.ts`
  - `src/lib/trpc/routers/prompts.ts`
  - `src/lib/trpc/routers/settings.ts`
  - `src/lib/trpc/routers/surveys.ts`
  - `src/lib/trpc/routers/hello.ts`

Procedure model:

- `publicProcedure`: unauthenticated
- `apiProcedure`: requires request/response context
- `authProcedure`: validates PropelAuth access token
- `orgProcedure`: validates organization membership

### 4.4 Data layer

Database access is centralized under `src/db`.

- `db.ts`: shared `postgres` and Drizzle client
- `schema.ts`: app schema definitions
- `scripts/migrate.ts`: migration runner
- `*.sql` and `meta/*`: generated migration history

Current schema covers:

- `prompts`: prompt records
- `prompt_likes`: user likes
- `gpt_keys`: org/user model API keys
- `shared_key_ratelimit`: shared-key usage caps
- `surveys`: public feedback submissions

The schema file documents an important operational rule: new tables require manual Row Level Security policy edits in generated SQL before migrations are applied.

## 5. Core product flows

### 5.1 Authentication and session sync

- Frontend auth UI is powered by PropelAuth components/hooks
- `src/components/AuthSync.tsx` mirrors PropelAuth session state into backend cookies
- `src/lib/trpc/trpc.ts` parses cookies and validates bearer tokens for protected procedures
- `src/lib/trpc/routers/auth.ts` writes the browser-visible and HTTP-only auth cookies

### 5.2 Prompt management

The main sample product is collaborative prompt sharing.

The prompt domain lives mostly in `src/lib/trpc/routers/prompts.ts` and supports:

- listing prompts visible to an org member
- fetching public/unlisted/team/private prompts with access checks
- creating, editing, deleting, and liking prompts
- running prompts against OpenAI with org key or shared key fallback

Prompt rendering/editing UI lives in `src/components/app/*Prompt*.tsx`.

### 5.3 Settings and billing

`src/lib/trpc/routers/settings.ts` handles:

- Stripe availability detection
- subscription lookup
- GPT key listing/creation/deletion

Stripe checkout is handled by `src/pages/api/create-checkout-session.ts`, while reusable Stripe logic lives in `src/lib/stripe.ts`.

### 5.4 Support and analytics

- Fogbender support widget: `src/components/fogbender/Support.tsx`
- Fogbender token endpoint: `src/pages/api/fogbender.ts`
- PostHog tracking helper: `src/lib/posthog.ts`
- Client PostHog injection: `src/components/head/Posthog.astro`

### 5.5 Setup and eject guides

This repo includes a built-in productized setup experience.

- Content definitions: `src/content/config.ts`
- Setup markdown: `src/content/setup/*`
- Eject markdown: `src/content/eject/*`
- Setup page: `src/pages/setup/index.astro`
- Eject page: `src/pages/eject/index.astro`
- Accordion component: `src/components/setup/SetupStep.astro`

The setup page computes completion from environment variables, so it doubles as both onboarding docs and a lightweight configuration status screen.

## 6. Rendering model

The app mixes multiple rendering strategies:

- static pages for marketing-style content
- SSR for authenticated app pages and API-backed pages
- React hydration for interactive screens
- server-side data prefetch via tRPC helpers
- client-side cache hydration through TanStack Query

Important bridge files:

- `src/lib/router.tsx`
- `src/lib/trpc/root.ts`
- `src/components/trpc.tsx`
- `src/components/app/routes.tsx`

The intended flow is:

1. Astro receives the request
2. Astro builds SSR context and tRPC helpers
3. React Router loaders prefetch key tRPC queries
4. Astro returns HTML plus dehydrated query state
5. React hydrates on the client and continues navigation

## 7. Environment contract

Environment validation is implemented in `src/t3-env.ts`.

### Required server variables

- `DATABASE_URL`
- `PROPELAUTH_API_KEY`
- `PROPELAUTH_VERIFIER_KEY`

### Required client/public variables

- `PUBLIC_AUTH_URL`

### Optional integrations

- `FOGBENDER_SECRET`
- `PUBLIC_FOGBENDER_WIDGET_ID`
- `PUBLIC_POSTHOG_KEY`
- `OPENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_PRICE_ID`

There is also a `SKIP_ENV_VALIDATION` escape hatch, mainly for local/dev workflows.

## 8. Quality gates and developer workflow

Primary scripts:

- `yarn dev`: local development
- `yarn build`: production build
- `yarn ci:check`: Astro check + TypeScript
- `yarn lint`: ESLint
- `yarn fmt`: Prettier
- `yarn migrate`: DB migrations

CI runs three separate checks:

- lint
- prettier
- type checking

There is no automated test runner configured in the repo today.

## 9. Structural strengths

- Clear separation between pages, API routers, DB schema, and UI components
- Strong typed API contract via tRPC
- Early environment validation with good developer guidance
- Built-in setup/eject documentation system
- Useful starter integrations for a B2B SaaS product

## 10. Structural complexity to keep in mind

- `/app` uses both Astro file routes and React Router
- setup/eject UI introduces Solid into an otherwise React-first app
- generated Drizzle artifacts live next to hand-maintained DB code
- integrations are optional, but many flows branch on env configuration
- the repo is both a product sample and a starter kit, so some code exists for demonstration rather than production rigor
