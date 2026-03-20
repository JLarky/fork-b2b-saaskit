# Top 10 priorities for this repository

Ordered by impact on **security**, **maintainability**, and **contributor clarity**. Numbers are priority rank, not effort estimates.

1. **Remove or replace committed `.env`** — Stop tracking `.env`; add `.env` to `.gitignore` if appropriate, provide `.env.example` with dummy keys, and point setup docs at Doppler / local copy-paste.

2. **Audit tRPC procedures for authz** — Resolve the prompts-router TODO and systematically review every procedure: ensure org-scoped and privacy rules cannot be bypassed via optional `orgId` or unauthenticated paths.

3. **Declare `superjson` (and audit other implicit deps)** — Add direct `dependencies` entries for packages imported in app code but only pulled transitively, starting with `superjson` and `zod` if not already direct.

4. **Align CI Node version with documented engines** — Match `.github/actions/prepare` (and workflows) to the Node range in `package.json` or document a single recommended version for contributors and CI.

5. **Decide production sourcemaps policy** — Either disable client sourcemaps in production builds or document why they stay on (debugging vs. exposed source tradeoff) in `astro.config.mjs`.

6. **Address tRPC SSR dehydration TODO** — Implement or document the intended pattern in `src/components/trpc.tsx` so server-prefetched data and the React Query cache stay consistent.

7. **Document Astro + React Router split** — Add a short “routing map” (which URLs are Astro vs React Router, where loaders prefetch) to reduce onboarding time for new contributors.

8. **Harden optional integrations** — Stripe, PostHog, Fogbender, OpenAI: ensure no-op behavior when env is missing, no runtime throws on marketing pages, and feature flags are obvious in one place.

9. **Automate or checklist Supabase RLS** — After each `drizzle-kit generate`, verify migration SQL includes RLS policies (script, template, or CI grep) so new tables are not deployed wide open by mistake.

10. **Expand automated tests** — Add a minimal test layer (e.g. Vitest for tRPC callers or integration tests against a test DB) for critical routers (`prompts`, `auth`, `settings`) to guard regressions in org and privacy logic.

---

*Generated from a full-repo pass; adjust ordering to match product roadmap (e.g. tests before RLS automation if you are not on Supabase).*
