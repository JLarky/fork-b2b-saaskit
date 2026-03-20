# TODO — Top 10 Most Important Tasks

## 1. Add Automated Testing
**Priority: Critical**

Set up Vitest (or a similar framework) and write tests for the most critical code paths:
- Unit tests for tRPC routers (`prompts.ts` access control logic, rate limiting, auth flow)
- Integration tests for the auth middleware chain (`publicProcedure` → `apiProcedure` → `authProcedure` → `orgProcedure`)
- Add a test CI workflow alongside the existing lint/prettier/typescript checks

**Files:** new `vitest.config.ts`, `src/lib/trpc/routers/*.test.ts`, `.github/workflows/test.yml`

---

## 2. Encrypt Stored API Keys
**Priority: Critical**

OpenAI API keys are currently stored in plaintext in the `gpt_keys` table. Implement encryption at rest:
- Encrypt `keySecret` before writing to the database
- Decrypt on read when calling the OpenAI API
- Use a server-side encryption key managed via Doppler

**Files:** `src/lib/trpc/routers/settings.ts`, `src/lib/trpc/routers/prompts.ts`, `src/db/schema.ts`

---

## 3. Update OpenAI Model Support
**Priority: High**

The `gptTypeEnum` only supports `gpt-3` and `gpt-4`. Update to support current models:
- Add `gpt-4o`, `gpt-4-turbo`, and other current models to the enum
- Run a database migration to update the `gpt_type` enum
- Update the model selection UI in `Settings.tsx`
- Update the `runPrompt` mutation to use correct model identifiers

**Files:** `src/db/schema.ts`, `src/lib/trpc/routers/prompts.ts`, `src/components/app/Settings.tsx`

---

## 4. Add Database Indexes
**Priority: High**

Add indexes for commonly queried columns to prevent full table scans as data grows:
- `prompts.org_id` — filtered in `getPrompts`
- `prompts.privacy_level` — filtered in `getPublicPrompts`
- `prompts.user_id` — filtered in ownership checks
- `gpt_keys.org_id` — filtered in key lookups
- Generate and apply a Drizzle migration

**Files:** `src/db/schema.ts`, new migration in `src/db/`

---

## 5. Add Pagination to Prompt Queries
**Priority: High**

Both `getPrompts` and `getPublicPrompts` return unbounded result sets. Implement cursor-based or offset pagination:
- Add `limit` and `cursor`/`offset` input params to both procedures
- Return pagination metadata (total count, next cursor, has more)
- Update the `Prompts.tsx` UI with load-more or pagination controls

**Files:** `src/lib/trpc/routers/prompts.ts`, `src/components/app/Prompts.tsx`

---

## 6. Fix Copy-Paste Bugs and Dead Code
**Priority: Medium**

Several issues from code reuse need cleanup:
- `settings.ts` `deleteKey` error messages say "Prompt not found" and "delete your own prompts" — should reference keys
- Remove `solid-js` from `package.json` (unused dependency)
- Remove `console.log` in `AuthSync.tsx`
- Deduplicate PropelAuth initialization — `create-checkout-session.ts` should import the singleton from `src/lib/propelauth.ts`

**Files:** `src/lib/trpc/routers/settings.ts`, `package.json`, `src/components/AuthSync.tsx`, `src/pages/api/create-checkout-session.ts`

---

## 7. Add React Error Boundaries
**Priority: Medium**

The app has no error boundaries — any runtime rendering error crashes the entire UI. Add error boundaries:
- Wrap the app shell in `routes.tsx` with a top-level error boundary
- Add per-route error boundaries for the prompt detail/edit pages
- Display user-friendly error messages with retry options

**Files:** `src/components/app/routes.tsx`, new `src/components/app/ErrorBoundary.tsx`

---

## 8. Fix Prettier CI Workflow
**Priority: Medium**

The current CI command `yarn fmt --check --write=false` is incorrect:
- `fmt` script runs `prettier --write`, which contradicts `--check`
- `--write=false` is not a valid Prettier flag
- Replace with a dedicated CI script: `"fmt:check": "prettier --check --ignore-unknown ."`
- Update the workflow to use `yarn fmt:check`

**Files:** `package.json`, `.github/workflows/prettier.yml`

---

## 9. Add Rate Limit Cleanup and Improve Strategy
**Priority: Medium**

The `shared_key_ratelimit` table grows indefinitely with one row per user per 24-hour period. Fix this:
- Add a cleanup mechanism (e.g., a migration script, a cron-triggered API route, or a Supabase scheduled function)
- Consider switching to a sliding window algorithm or using a proper rate-limiting service
- Add an index on `created_at` for efficient cleanup queries

**Files:** `src/db/schema.ts`, `src/lib/trpc/routers/prompts.ts`, new cleanup script

---

## 10. Update Stale Dependencies
**Priority: Medium**

Several dependencies are significantly outdated:
- `stripe` at `^12.12.0` with API version `2022-11-15` — update both the package and the pinned API version
- `@propelauth/react` at `2.1.0-beta.4` — move to a stable release
- `@tanstack/react-query` at `^4.29.5` — evaluate upgrading to v5 (and the corresponding tRPC adapter)
- `tailwindcss` at `^3.3.3` — evaluate upgrading to v4
- Review and update all dependencies, running the full test suite (once task #1 is done) after each major upgrade

**Files:** `package.json`, `yarn.lock`, `src/lib/stripe.ts`
