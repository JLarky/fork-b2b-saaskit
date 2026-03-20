# B2B SaaS Kit — Code Review

## What's Good

### 1. End-to-End Type Safety with tRPC
The tRPC setup provides full type safety from database schema through API procedures to React hooks. Zod schemas validate all inputs, and TypeScript infers response types automatically. The progressive middleware chain (`publicProcedure` → `apiProcedure` → `authProcedure` → `orgProcedure`) is well-designed — each level adds context and guarantees, and downstream procedures can rely on the types established upstream.

### 2. Clean Auth Middleware Architecture
The authentication middleware in `src/lib/trpc/trpc.ts` uses lazy evaluation via `unthunk` to avoid unnecessary work. Access tokens are only parsed when needed, user validation only runs when an `authProcedure` requires it. The cookie-based session mechanism in `AuthSync.tsx` bridges client-side PropelAuth state with server-side cookies elegantly.

### 3. SSR + SPA Hybrid Pattern
The combination of Astro SSR for initial page loads with React Router for in-app navigation is thoughtfully implemented. The `ServerRouter` / `BrowserRouter` split in `Root.tsx` and the `createStaticHandler` integration in `src/lib/router.tsx` allow tRPC data to be prefetched server-side and dehydrated into the client — giving both good SEO and fast client-side transitions.

### 4. Comprehensive Setup & Eject Documentation
The content collections in `src/content/setup/` and `src/content/eject/` are a standout feature. Each third-party integration has both a setup guide and an eject guide, which is rare in starter kits. This makes the kit genuinely practical for building real products.

### 5. Environment Variable Validation
Using `@t3-oss/env-core` with Zod schemas (`src/t3-env.ts`) to validate env vars at startup is excellent practice. The custom error messages include hints for development, and the `SKIP_ENV_VALIDATION` escape hatch is a practical touch. The separation between server and client env vars prevents accidental secret leakage.

### 6. Well-Chosen Service Integrations
Every integrated service (Doppler, Supabase, PropelAuth, Stripe, PostHog, Fogbender) has a free tier. The architecture makes each optional (Stripe, PostHog, Fogbender can be absent without breaking the app), which aligns with the "build for the cost of a domain" goal.

### 7. Optimistic UI Updates
The `Prompts.tsx` component implements proper optimistic updates with rollback on error for the delete mutation — `onMutate` snapshots previous state, sets optimistic data, and `onError` rolls back. This is textbook React Query usage and provides a responsive user experience.

### 8. Drizzle ORM Schema Design
The schema in `src/db/schema.ts` is clean and includes RLS policy comments as documentation. Using a composite primary key for `prompt_likes` prevents duplicate likes at the database level. The rate limiting implementation via upsert is a pragmatic approach.

### 9. ESLint + Prettier CI Enforcement
The CI pipeline enforces code quality with separate workflows for linting, formatting, and type checking. The ESLint flat config is modern and well-organized.

### 10. Astro Content Collections for Docs
Using Astro's built-in content system for documentation means the guides benefit from type-checking, frontmatter validation, and the full Astro rendering pipeline, instead of being disconnected markdown files.

---

## What Needs Improvement

### 1. Zero Test Coverage
There are no test files, no test framework, and no test runner configured. No unit tests, integration tests, or end-to-end tests exist. For a starter kit that's meant to be modified into production software, this is a significant gap. At minimum, the tRPC routers (especially `prompts.ts` with its access control logic) should have unit tests, and the auth flow should have integration tests.

### 2. OpenAI API Key Stored in Plaintext
In `src/lib/trpc/routers/settings.ts`, the `createKey` mutation stores the OpenAI API key's secret (`keySecret`) directly in the database without encryption. While the database has RLS policies and the connection is to Supabase, storing third-party API keys in plaintext is a security concern — a database breach would expose all org API keys.

### 3. Duplicated PropelAuth Initialization
`initBaseAuth` is called in two places: once as a module-level singleton in `src/lib/propelauth.ts`, and again inline inside the `/api/create-checkout-session.ts` handler. The checkout session handler should import and reuse the singleton rather than creating a new instance per request.

### 4. `any` Casts and Disabled TypeScript Rules
The ESLint config disables several important TypeScript safety rules: `no-explicit-any`, `no-unsafe-return`, `no-unsafe-call`, `no-unsafe-member-access`, `no-unused-vars`, and `no-floating-promises`. In `Settings.tsx`, form data is cast with `as any`. These undermine the type safety the project otherwise achieves with tRPC and Zod.

### 5. Hardcoded GPT Model Names
In `src/lib/trpc/routers/prompts.ts`, the OpenAI model is selected with `key?.keyType === 'gpt-4' ? 'gpt-4' : 'gpt-3.5-turbo'`. The `gptTypeEnum` only supports `gpt-3` and `gpt-4`, which are outdated. There's no support for GPT-4 Turbo, GPT-4o, o1, or any newer models. The model selection should be configurable or at least updated.

### 6. Missing Error Boundaries
There are no React error boundaries in the component tree. If a component throws during render (e.g., a malformed prompt template), the entire app crashes with a white screen. The `usePromptErrorPage.tsx` file exists but only handles tRPC errors — runtime rendering errors are unhandled.

### 7. Inconsistent Error Messages in Settings Router
In `src/lib/trpc/routers/settings.ts`, the `deleteKey` mutation has copy-pasted error messages that reference "prompts" instead of "keys": `'Prompt not found'` and `'You can only delete your own prompts.'`. These should reference keys/API keys.

### 8. No Database Indexing Strategy
The schema defines primary keys but no additional indexes. Queries in `prompts.ts` filter by `orgId`, `userId`, and `privacyLevel` — these columns should be indexed. The `prompt_likes` table is joined on `promptId` which also lacks an explicit index beyond the composite PK.

### 9. Rate Limiting Has No Cleanup
The `shared_key_ratelimit` table accumulates rows over time (one per user per 24-hour period). There's no cleanup mechanism — no cron job, no TTL, no periodic purge. Over time this table will grow unboundedly.

### 10. Stale Stripe API Version
`src/lib/stripe.ts` pins the Stripe API version to `'2022-11-15'`, which is over 3 years old. The `stripe` package is at `^12.12.0` while current versions are much higher. This may cause deprecation warnings or miss important API improvements and security patches.

### 11. Missing CSRF Protection
The `authSync` mutation accepts an access token from the client and sets HTTP-only cookies. While the cookies have `sameSite: 'strict'`, the tRPC endpoint itself doesn't verify request origin headers. In combination with the cookie-based auth, this could be strengthened.

### 12. `solid-js` Listed as Dependency
`solid-js` appears in `package.json` dependencies but there are no SolidJS components or usage anywhere in the codebase. This is dead weight that adds to install size.

### 13. Prettier CI Workflow Uses Invalid Flag
The Prettier CI workflow runs `yarn fmt --check --write=false`. The `fmt` script is `prettier --write --ignore-unknown .`, so passing `--check` and `--write=false` together is contradictory. The `--write=false` flag is not a standard Prettier option. The CI command should be `prettier --check --ignore-unknown .` directly.

### 14. No Pagination for Prompts
`getPrompts` returns all prompts for an org without pagination. `getPublicPrompts` has a `LIMIT 100` but still no cursor/offset pagination. As prompt counts grow, this will cause performance issues and excessive data transfer.

### 15. Console.log Left in Production Code
`AuthSync.tsx` contains `console.log('expFromCookieNumber', ...)` which will fire on every auth sync in production browsers. Debug logging should be removed or guarded behind a dev check.

### 16. No Input Sanitization on Prompt Content
Prompt templates (user/assistant/system messages) are stored and returned as-is. While React's JSX escaping prevents XSS in the rendered output, the raw content could contain malicious payloads if consumed by other systems or APIs.

### 17. Delete Prompt Doesn't Cascade Properly
In the `deletePrompt` mutation, the prompt and its likes are deleted in separate queries without a transaction. If the second delete fails, orphaned `prompt_likes` rows will remain in the database.

---

## Summary

The B2B SaaS Kit makes strong architectural decisions — the tRPC middleware chain, SSR/SPA hybrid rendering, and content-based documentation system are all well-executed. The code is generally clean and idiomatic TypeScript/React.

The biggest concerns are the complete absence of automated tests, some security oversights (plaintext API key storage, stale dependencies), and accumulated technical debt (disabled linter rules, hardcoded model names, copy-paste errors). These are typical for a fast-moving starter project but should be addressed before building production software on top of the kit.
