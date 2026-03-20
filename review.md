# Codebase review — strengths and gaps

This is a structured review of the B2B SaaS Kit repository: what works well for a starter, and what deserves attention before production hardening or long-term maintenance.

## What works well

**Clear product and onboarding story**  
The README is unusually thorough: stack rationale, Drizzle migration steps (including Supabase RLS), and tRPC patterns with SSR/dehydration. The `/setup` and `/eject` content collections turn onboarding into first-class, versioned docs inside the app.

**Modern, cohesive stack**  
Astro for static/SSR + React for the heavy client, tRPC for end-to-end types, Drizzle for SQL-first schema, and PropelAuth for B2B auth fit together naturally. The `orgProcedure` pattern encodes multi-tenant checks in one place.

**Developer experience**  
Vite plugin checker, ESLint 9 flat config, Prettier (including Astro and Tailwind plugins), and CI workflows for lint/format/types reduce drift. `createHelpers(Astro)` and route loaders show intentional SSR prefetching for the React app.

**Env discipline (conceptually)**  
`t3-env.ts` centralizes validation and documents common failure modes (e.g. running without Doppler). Splitting client env via `PUBLIC_` and `src/config.ts` is the right direction for avoiding accidental secret leakage to the client.

**Example app depth**  
The prompts domain (privacy levels, likes, org-scoped data, Stripe hooks in the prompts router) demonstrates real patterns, not a toy counter — useful for teams forking the kit.

## What is weak or risky

**Tracked `.env` file**  
A `.env` file is present in the repo. Even if it only contains comments or placeholders today, committing `.env` trains the wrong habit and makes it easy for a future edit to leak secrets. Prefer `.env.example` plus docs, and ensure `.gitignore` covers `.env`.

**Implicit dependency on `superjson`**  
`t3-env.ts` / tRPC use `superjson`, but it is not declared in `package.json` (it arrives transitively). Pinning it as a direct dependency avoids surprise breakage when upstream packages change.

**Production build and Node version drift**  
`astro.config.mjs` enables production `sourcemap: true` with an inline note to reconsider for production — worth deciding explicitly. CI uses Node 18 via `actions/setup-node` while `package.json` allows 18.17 / 20.3 / ≥22; aligning CI with the minimum supported version (or the one you recommend) reduces “works on my machine” issues.

**Security and access-control TODOs**  
There is an explicit TODO in the prompts router around user/org access for some paths. Any fork going to production should audit all `publicProcedure` / `apiProcedure` usages and ensure org boundaries and privacy rules are enforced consistently.

**tRPC client / dehydration**  
A TODO in `trpc.tsx` notes passing `dehydratedState` via the tRPC client path; until addressed, some SSR/hydration edge cases may be harder to reason about or duplicate configuration between Query and tRPC layers.

**Dual routing mental model**  
File-based Astro routes plus an embedded React Router tree for `/app` is powerful but requires contributors to know two systems and where prefetch runs (Astro vs loader). Brief architecture diagrams in repo docs help onboarding.

**Database access pattern**  
The app uses a service-style Postgres connection with RLS policies documented for `service_role`. That is a valid pattern for a backend-only kit, but teams using Supabase client-side or direct browser access need a different threat model — the kit should keep that distinction obvious in docs.

**Survey and ancillary features**  
Tables like `surveys` support product feedback; ensure retention, PII in comments, and admin access are documented or gated if used in production.

## Summary

The kit scores high on **documentation, stack fit, and example richness**. The main improvements are **operational hygiene** (env files, explicit dependencies, CI/runtime alignment), **closing security TODOs**, and **small technical-debt items** called out in code (tRPC dehydration, optional sourcemaps). Treat this review as a checklist for hardening, not as a verdict on the starter’s fitness for its stated goal (fast B2B SaaS bootstrap).
