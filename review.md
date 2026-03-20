# Repository review

This review is intentionally opinionated. The repo is a strong starter kit with thoughtful full-stack wiring, but it still carries several "template code" tradeoffs that would matter in a production app.

## What is good

### 1. The full-stack backbone is coherent

The main technical choices fit together well:

- Astro handles page routing and SSR shells cleanly
- React handles the interactive product surface
- tRPC provides a typed API boundary
- TanStack Query supports prefetching and hydration
- Drizzle keeps schema and query code close together

This makes the repo easy to reason about once you understand the Astro -> React Router -> tRPC flow.

### 2. Environment validation is stronger than in many starter repos

`src/t3-env.ts` does real validation, clearly separates server/public variables, and throws actionable errors in development. That significantly lowers setup friction and misconfiguration debugging time.

### 3. The auth and org membership model is well reflected in backend procedures

The progression from `publicProcedure` to `apiProcedure` to `authProcedure` to `orgProcedure` is one of the cleanest parts of the repo. It creates a reusable security model and prevents auth logic from being copy-pasted through every router.

### 4. The built-in setup and eject docs are a real differentiator

`src/content/setup/*` and `src/content/eject/*` make the starter kit self-explanatory. Most templates stop at a README; this repo turns onboarding and de-scaffolding into actual product features.

### 5. The prompt domain is substantial enough to be useful

This is not a toy counter app dressed up as a SaaS starter. Prompts, likes, privacy levels, org scoping, shared-vs-org OpenAI keys, billing checks, and support integration give new adopters a realistic starting point.

### 6. CI and code quality tooling exist from day one

Lint, format, and type-check workflows are already wired. That gives contributors a baseline and keeps the repo from drifting immediately.

## What is bad or risky

### 1. There are no automated tests

This is the biggest gap.

- No unit tests
- No integration tests
- No API-level regression tests
- No smoke tests for the important auth/billing/prompt flows

For a repo that aims to be heavily customized, lack of tests makes safe modification much harder.

### 2. Several important lint safety rules are disabled

`eslint.config.js` disables a wide range of rules that normally catch real bugs:

- floating promises
- unsafe calls/member access/returns
- explicit `any`
- unused vars
- non-null assertions

That makes local feedback much weaker than the TypeScript setup suggests.

### 3. The repo mixes two routing systems for the app shell

The `/app` experience relies on:

- Astro file routes for HTTP entry points
- React Router for in-app route definitions and loaders

This works, but it creates two places contributors must understand and sometimes keep aligned. It is not immediately obvious where a new screen should be added or where prefetching logic belongs.

### 4. A React-first app still depends on Solid for setup accordions

`src/components/setup/SetupStep.astro` brings in Solid just to power collapsible setup/eject sections. It is clever, but it adds another UI runtime, more dependency surface, and more cognitive overhead than the feature likely deserves.

### 5. Some demo/starter code still looks too production-adjacent

`src/lib/trpc/routers/hello.ts` exposes an in-memory counter via public procedures. That is fine for teaching, but weak as shipped application code because:

- state resets on restart
- behavior breaks across multiple instances
- it is public mutation surface with no practical product value

Starter/demo code should be more clearly isolated or removed before production use.

### 6. Public write paths are lightly protected

`surveys.postSurvey` is public and has no visible rate limiting, spam control, or abuse mitigation. That is acceptable in a demo, but it is risky in a public deployment.

### 7. Observability is minimal in the main request path

Error handling exists, but there is not much structured logging or obvious production diagnostics around:

- tRPC server errors
- external service failures
- auth sync failures
- Stripe/OpenAI operational issues

That increases time-to-debug once real traffic exists.

### 8. A few code comments already acknowledge technical debt

Examples include:

- TODOs around key handling and typing
- a comment in `src/components/trpc.tsx` saying dehydrated state should be passed differently
- schema comments requiring manual migration edits

These are not failures, but they show where the starter has rough edges.

## Overall assessment

This repo is good at the hardest part of a starter kit: it gives a believable, end-to-end B2B SaaS shape instead of disconnected examples.

Its weakest area is production hardening. The current state is best described as:

- strong architecture for a starter
- good onboarding/documentation story
- decent safety around auth and config
- insufficient safety around testing, abuse prevention, and long-term maintainability

## Recommended direction

If this repo is meant to remain a starter kit:

- keep the architecture
- simplify the mixed-runtime/mixed-routing story where possible
- add a thin but serious automated test baseline
- harden public endpoints and operational visibility

If this repo is meant to become a production app:

- treat the current code as a strong prototype foundation, not a finished production baseline
