# TODO

- [x] Phase 1: Add Effect, define services, typed errors (docs/specs/effect-migration.md)
- [ ] Phase 2: Migrate standalone API routes to Effect (fogbender.ts, create-checkout-session.ts)
- [ ] Phase 3: Migrate pure-ish routers to Effect (surveys, hello)
- [ ] Phase 4: Migrate complex routers to Effect (auth, settings, prompts)
- [ ] Phase 5: Replace tRPC with Effect HTTP (optional, see spec)

## Discovered during Phase 1 (for human review)

- [ ] `prompts.ts` has two functions (`resolvePropelAuthUsers`, `resolvePropelPublicUsers`) that TypeScript hints could be async — consider converting
- [ ] PostHog analytics creates a new client + shutdownAsync per event call (both in existing `posthog.ts` and new `AnalyticsLive`); consider a long-lived client if the deployment model allows batched flush
- [ ] The two standalone API routes (`fogbender.ts`, `create-checkout-session.ts`) each create their own `initBaseAuth()` inline — Phase 2 will unify these on the `Auth` service layer
- [ ] `effect-migration.md` spec snippets use `process.env` and `BaseAuthClient`; implementation uses `serverEnv` and `ReturnType<typeof initBaseAuth>` — consider syncing the spec to match implementation patterns
